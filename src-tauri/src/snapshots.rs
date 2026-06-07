use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::parser::GraphData;
use rusqlite::{params, Connection};

#[derive(Serialize, Deserialize, Clone)]
pub struct SnapshotMeta {
    pub name: String,
    pub timestamp: String,
    pub node_count: usize,
    pub edge_count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct SnapshotDiff {
    pub added_nodes: Vec<String>,
    pub removed_nodes: Vec<String>,
    pub added_edges: Vec<(String, String)>,
    pub removed_edges: Vec<(String, String)>,
}

fn get_snapshots_dir(workspace_path: &str) -> std::path::PathBuf {
    Path::new(workspace_path).join(".codemapper").join("snapshots")
}

fn sanitize_snapshot_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Snapshot name is required".to_string());
    }
    if trimmed.contains("..")
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains(':')
        || trimmed.contains('*')
        || trimmed.contains('?')
        || trimmed.contains('"')
        || trimmed.contains('<')
        || trimmed.contains('>')
        || trimmed.contains('|')
    {
        return Err("Snapshot name contains unsupported path characters".to_string());
    }
    Ok(trimmed.to_string())
}

fn open_snapshots_db(workspace_path: &str) -> Result<Connection, String> {
    let db_path = crate::security::ensure_workspace_child(workspace_path, ".codemapper/snapshots.db")?;
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS snapshots (
            name TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            node_count INTEGER NOT NULL,
            edge_count INTEGER NOT NULL,
            data_json TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub async fn save_snapshot(
    workspace_path: String,
    name: String,
    graph_data: GraphData,
) -> Result<(), String> {
    let name = sanitize_snapshot_name(&name)?;
    let dir = get_snapshots_dir(&workspace_path);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let timestamp = chrono::Utc::now().to_rfc3339();
    
    let meta = SnapshotMeta {
        name: name.clone(),
        timestamp,
        node_count: graph_data.nodes.len(),
        edge_count: graph_data.edges.len(),
    };

    // Save portable metadata and graph data files for easy inspection/export.
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(dir.join(format!("{}.meta.json", name)), meta_json).map_err(|e| e.to_string())?;

    let data_json = serde_json::to_string(&graph_data).map_err(|e| e.to_string())?;
    fs::write(dir.join(format!("{}.data.json", name)), &data_json).map_err(|e| e.to_string())?;

    let conn = open_snapshots_db(&workspace_path)?;
    conn.execute(
        "INSERT OR REPLACE INTO snapshots (name, timestamp, node_count, edge_count, data_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            meta.name,
            meta.timestamp,
            meta.node_count as i64,
            meta.edge_count as i64,
            data_json
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn list_snapshots(workspace_path: String) -> Result<Vec<SnapshotMeta>, String> {
    if let Ok(conn) = open_snapshots_db(&workspace_path) {
        let mut stmt = conn
            .prepare(
                "SELECT name, timestamp, node_count, edge_count
                 FROM snapshots
                 ORDER BY timestamp DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(SnapshotMeta {
                    name: row.get(0)?,
                    timestamp: row.get(1)?,
                    node_count: row.get::<_, i64>(2)? as usize,
                    edge_count: row.get::<_, i64>(3)? as usize,
                })
            })
            .map_err(|e| e.to_string())?;

        let snapshots: Result<Vec<_>, _> = rows.collect();
        return snapshots.map_err(|e| e.to_string());
    }

    let dir = get_snapshots_dir(&workspace_path);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy();
                if filename.ends_with(".meta.json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(meta) = serde_json::from_str::<SnapshotMeta>(&content) {
                            snapshots.push(meta);
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp descending
    snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    Ok(snapshots)
}

#[tauri::command]
pub async fn diff_snapshots(
    workspace_path: String,
    a_name: String,
    b_name: String,
) -> Result<SnapshotDiff, String> {
    let a_name = sanitize_snapshot_name(&a_name)?;
    let b_name = sanitize_snapshot_name(&b_name)?;
    if let Ok(conn) = open_snapshots_db(&workspace_path) {
        let a_content: String = conn
            .query_row(
                "SELECT data_json FROM snapshots WHERE name = ?1",
                params![a_name],
                |row| row.get(0),
            )
            .map_err(|e| format!("Snapshot A missing: {}", e))?;
        let b_content: String = conn
            .query_row(
                "SELECT data_json FROM snapshots WHERE name = ?1",
                params![b_name],
                |row| row.get(0),
            )
            .map_err(|e| format!("Snapshot B missing: {}", e))?;

        return diff_graph_data(&a_content, &b_content);
    }

    let dir = get_snapshots_dir(&workspace_path);
    
    let a_path = dir.join(format!("{}.data.json", a_name));
    let b_path = dir.join(format!("{}.data.json", b_name));

    let a_content = fs::read_to_string(a_path).map_err(|e| format!("Snapshot A missing: {}", e))?;
    let b_content = fs::read_to_string(b_path).map_err(|e| format!("Snapshot B missing: {}", e))?;

    diff_graph_data(&a_content, &b_content)
}

fn diff_graph_data(a_content: &str, b_content: &str) -> Result<SnapshotDiff, String> {
    let a_data: GraphData = serde_json::from_str(a_content).map_err(|e| e.to_string())?;
    let b_data: GraphData = serde_json::from_str(b_content).map_err(|e| e.to_string())?;

    let a_node_ids: std::collections::HashSet<String> = a_data.nodes.into_iter().map(|n| n.id).collect();
    let b_node_ids: std::collections::HashSet<String> = b_data.nodes.into_iter().map(|n| n.id).collect();

    let added_nodes = b_node_ids.difference(&a_node_ids).cloned().collect();
    let removed_nodes = a_node_ids.difference(&b_node_ids).cloned().collect();

    let a_edge_ids: std::collections::HashSet<(String, String)> = a_data.edges.into_iter().map(|e| (e.source, e.target)).collect();
    let b_edge_ids: std::collections::HashSet<(String, String)> = b_data.edges.into_iter().map(|e| (e.source, e.target)).collect();

    let added_edges = b_edge_ids.difference(&a_edge_ids).cloned().collect();
    let removed_edges = a_edge_ids.difference(&b_edge_ids).cloned().collect();

    Ok(SnapshotDiff {
        added_nodes,
        removed_nodes,
        added_edges,
        removed_edges,
    })
}

#[tauri::command]
pub async fn delete_snapshot(workspace_path: String, name: String) -> Result<(), String> {
    let name = sanitize_snapshot_name(&name)?;
    let conn = open_snapshots_db(&workspace_path)?;
    conn.execute("DELETE FROM snapshots WHERE name = ?1", params![&name])
        .map_err(|e| e.to_string())?;

    let dir = get_snapshots_dir(&workspace_path);
    let _ = fs::remove_file(dir.join(format!("{}.meta.json", name)));
    let _ = fs::remove_file(dir.join(format!("{}.data.json", name)));
    Ok(())
}
