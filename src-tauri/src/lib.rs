use ignore::{DirEntry, WalkBuilder};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

fn is_ignored(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| {
            s.starts_with('.')
                || s == "node_modules"
                || s == "target"
                || s == "dist"
                || s == "build"
                || s.starts_with("next-env")
                || s == "next.config.ts"
                || s == "next.config.js"
        })
        .unwrap_or(false)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        if component.as_os_str() == ".." {
            normalized.pop();
        } else if component.as_os_str() != "." {
            normalized.push(component);
        }
    }
    normalized
}

#[derive(Serialize, Clone)]
pub struct ParsedNode {
    pub id: String,
    pub label: String,
    pub group: String,
}

#[derive(Serialize, Clone)]
pub struct ParsedEdge {
    pub source: String,
    pub target: String,
}

#[derive(Serialize)]
pub struct GraphData {
    pub nodes: Vec<ParsedNode>,
    pub edges: Vec<ParsedEdge>,
}

#[tauri::command]
async fn parse_codebase(path: String) -> Result<GraphData, String> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err("Path does not exist".to_string());
    }

    struct FileData {
        id: String,
        path: PathBuf,
        imports: Vec<String>,
    }

    let mut files_data = Vec::new();

    for result in WalkBuilder::new(path_ref)
        .hidden(true) // ignore hidden files/dirs (.git, .env)
        .git_ignore(true) // respect .gitignore
        .filter_entry(|e| !is_ignored(e))
        .build()
    {
        if let Ok(entry) = result {
            let file_path = entry.path();
            if file_path.is_file() {
                let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("");
                if ext == "js" || ext == "ts" || ext == "jsx" || ext == "tsx" {
                    let id = file_path.to_string_lossy().replace('\\', "/");
                    let label = file_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    nodes.push(ParsedNode {
                        id: id.clone(),
                        label,
                        group: ext.to_string(),
                    });

                    let mut imports = Vec::new();
                    if let Ok(source_text) = fs::read_to_string(file_path) {
                        // Use regex to catch static imports, dynamic imports, require(), and re-exports
                        let re = regex::Regex::new(r#"(?:import|export)\s+(?:[^"']*?\s+from\s+)?['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap();
                        for caps in re.captures_iter(&source_text) {
                            if let Some(m) = caps.get(1).or_else(|| caps.get(2)) {
                                imports.push(m.as_str().to_string());
                            }
                        }
                    }

                    files_data.push(FileData {
                        id,
                        path: file_path.to_path_buf(),
                        imports,
                    });
                }
            }
        }
    }

    // Resolve imports to create edges
    for file_data in &files_data {
        let dir = file_data.path.parent().unwrap_or(Path::new(""));

        for import_str in &file_data.imports {
            let mut matched = false;

            if import_str.starts_with('.') {
                let resolved = normalize_path(&dir.join(import_str));
                // Try different extensions or index files
                let possible_paths = vec![
                    resolved.with_extension("ts"),
                    resolved.with_extension("tsx"),
                    resolved.with_extension("js"),
                    resolved.with_extension("jsx"),
                    resolved.join("index.ts"),
                    resolved.join("index.tsx"),
                    resolved.join("index.js"),
                    resolved.join("index.jsx"),
                ];

                for possible in possible_paths {
                    // normalize to the same format as id (forward slashes)
                    let possible_id = possible.to_string_lossy().replace('\\', "/");
                    if nodes.iter().any(|n| n.id == possible_id) {
                        edges.push(ParsedEdge {
                            source: file_data.id.clone(),
                            target: possible_id,
                        });
                        matched = true;
                        break;
                    }
                }
            }

            // Fallback for path aliases (e.g., @/components/Button) or baseUrl imports
            if !matched {
                let clean_import = import_str
                    .strip_prefix("@/")
                    .or_else(|| import_str.strip_prefix("~/"))
                    .unwrap_or(import_str);

                // Ignore likely node_modules without slashes unless they match exactly
                let suffixes = vec![
                    format!("/{}.ts", clean_import),
                    format!("/{}.tsx", clean_import),
                    format!("/{}.js", clean_import),
                    format!("/{}.jsx", clean_import),
                    format!("/{}/index.ts", clean_import),
                    format!("/{}/index.tsx", clean_import),
                    format!("/{}/index.js", clean_import),
                    format!("/{}/index.jsx", clean_import),
                ];

                for node in &nodes {
                    let mut found = false;
                    for suffix in &suffixes {
                        if node.id.ends_with(suffix) {
                            edges.push(ParsedEdge {
                                source: file_data.id.clone(),
                                target: node.id.clone(),
                            });
                            found = true;
                            break;
                        }
                    }
                    if found {
                        break;
                    }
                }
            }
        }
    }

    // Next.js Implicit Routing Connections
    let mut layout_nodes = Vec::new();
    let mut route_nodes = Vec::new();

    for node in &nodes {
        if node.label.starts_with("layout.") {
            layout_nodes.push(node);
        } else if node.label.starts_with("page.")
            || node.label.starts_with("loading.")
            || node.label.starts_with("template.")
            || node.label.starts_with("route.")
            || node.label.starts_with("error.")
            || node.label.starts_with("not-found.")
        {
            route_nodes.push(node);
        }
    }

    // A route node connects to its closest parent layout
    for r_node in &route_nodes {
        let mut current_dir = Path::new(&r_node.id).parent();
        let mut found_layout = None;

        while let Some(dir) = current_dir {
            let dir_str = dir.to_string_lossy().replace('\\', "/");

            if let Some(l) = layout_nodes.iter().find(|l| {
                Path::new(&l.id)
                    .parent()
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    == Some(dir_str.clone())
            }) {
                found_layout = Some(l);
                break;
            }
            current_dir = dir.parent();
        }

        if let Some(l) = found_layout {
            edges.push(ParsedEdge {
                source: l.id.clone(),
                target: r_node.id.clone(),
            });
        }
    }

    // Layouts connect to their parent layout
    for l_node in &layout_nodes {
        let current_dir = Path::new(&l_node.id).parent();
        if let Some(parent_dir) = current_dir.and_then(|p| p.parent()) {
            let mut search_dir = Some(parent_dir);
            let mut found_parent_layout = None;

            while let Some(dir) = search_dir {
                let dir_str = dir.to_string_lossy().replace('\\', "/");
                if let Some(parent_l) = layout_nodes.iter().find(|l| {
                    Path::new(&l.id)
                        .parent()
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        == Some(dir_str.clone())
                }) {
                    found_parent_layout = Some(parent_l);
                    break;
                }
                search_dir = dir.parent();
            }

            if let Some(parent_l) = found_parent_layout {
                // Ensure we don't duplicate edges if they imported it explicitly
                let exists = edges
                    .iter()
                    .any(|e| e.source == parent_l.id && e.target == l_node.id);
                if !exists {
                    edges.push(ParsedEdge {
                        source: parent_l.id.clone(),
                        target: l_node.id.clone(),
                    });
                }
            }
        }
    }

    Ok(GraphData { nodes, edges })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![parse_codebase])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
