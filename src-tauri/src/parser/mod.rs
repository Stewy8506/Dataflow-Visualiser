pub mod cpp;
pub mod dart;
pub mod javascript;
pub mod nextjs;
pub mod python;
pub mod rust;
pub mod tree_sitter_utils;
pub mod utils;

use ignore::WalkBuilder;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Window};
use tauri_plugin_fs::FsExt;

use cpp::{CPP_PARSER, C_PARSER};
use dart::DART_PARSER;
use javascript::extract_javascript_imports;
use nextjs::resolve_nextjs_edges;
use python::PYTHON_PARSER;
use rust::RUST_PARSER;
use tree_sitter_utils::extract_imports_with_parser;
use utils::{is_ignored, resolve_import_path};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct NodeMetrics {
    pub function_count: usize,
    pub import_count: usize,
    pub complexity_score: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedNode {
    pub id: String,
    pub label: String,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default)]
    pub metrics: Option<NodeMetrics>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedEdge {
    pub source: String,
    pub target: String,
    pub via: Option<String>,
    pub is_data_source: bool,
}

pub struct AliasResolver {
    package_paths: HashMap<PathBuf, HashMap<String, Vec<String>>>,
    monorepo_packages: HashMap<String, String>,
    workspace_root: PathBuf,
}

impl AliasResolver {
    pub fn new(workspace_root: &Path) -> Self {
        let mut package_paths = HashMap::new();
        let mut monorepo_packages = HashMap::new();

        for result in ignore::WalkBuilder::new(workspace_root)
            .hidden(true)
            .git_ignore(true)
            .build()
        {
            if let Ok(entry) = result {
                if !entry.path().is_file() {
                    continue;
                }

                let file_name = entry.path().file_name().unwrap_or_default();
                let parent_dir = entry.path().parent().unwrap().to_path_buf();

                if file_name == "tsconfig.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let re_line = Regex::new(r"(?m)//.*$").unwrap();
                        let re_block = Regex::new(r"(?s)/\*.*?\*/").unwrap();
                        let no_block = re_block.replace_all(&content, "");
                        let no_line = re_line.replace_all(&no_block, "");

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&no_line) {
                            if let Some(compiler_options) = json.get("compilerOptions") {
                                if let Some(paths_val) = compiler_options.get("paths") {
                                    if let Ok(paths_map) =
                                        serde_json::from_value::<HashMap<String, Vec<String>>>(
                                            paths_val.clone(),
                                        )
                                    {
                                        package_paths
                                            .entry(parent_dir.clone())
                                            .or_insert_with(HashMap::new)
                                            .extend(paths_map);
                                    }
                                }
                            }
                        }
                    }
                } else if file_name == "vite.config.ts" || file_name == "vite.config.js" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let re = Regex::new(r#"["'](@/.*?)["']\s*:\s*["'](.*?)["']"#).unwrap();
                        let mut vite_paths = HashMap::new();
                        for cap in re.captures_iter(&content) {
                            if let (Some(alias), Some(target)) = (cap.get(1), cap.get(2)) {
                                vite_paths.insert(
                                    alias.as_str().to_string(),
                                    vec![target.as_str().to_string()],
                                );
                            }
                        }
                        if !vite_paths.is_empty() {
                            package_paths
                                .entry(parent_dir.clone())
                                .or_insert_with(HashMap::new)
                                .extend(vite_paths);
                        }
                    }
                } else if file_name == "package.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(name) = json.get("name").and_then(|n| n.as_str()) {
                                if let Ok(rel_path) = parent_dir.strip_prefix(workspace_root) {
                                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                                    monorepo_packages.insert(
                                        name.to_string(),
                                        if rel_str.is_empty() {
                                            ".".to_string()
                                        } else {
                                            rel_str
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        Self {
            package_paths,
            monorepo_packages,
            workspace_root: workspace_root.to_path_buf(),
        }
    }

    pub fn resolve(&self, import_str: &str, current_file_path: &Path) -> String {
        for (pkg_name, pkg_path) in &self.monorepo_packages {
            if import_str == pkg_name || import_str.starts_with(&format!("{}/", pkg_name)) {
                let rest = import_str.strip_prefix(pkg_name).unwrap_or("");
                let mut resolved = format!("{}{}", pkg_path, rest);
                if resolved.starts_with("./") {
                    resolved = resolved.strip_prefix("./").unwrap().to_string();
                }
                if resolved == "." {
                    resolved = pkg_path.to_string();
                }
                return resolved;
            }
        }

        // Find closest config by traversing up from current_file_path
        let mut search_dir = current_file_path.parent();
        while let Some(dir) = search_dir {
            if let Some(paths) = self.package_paths.get(dir) {
                for (alias, targets) in paths {
                    let alias_prefix = alias.trim_end_matches('*');
                    if import_str.starts_with(alias_prefix) {
                        if let Some(target) = targets.first() {
                            let target_prefix = target.trim_end_matches('*');
                            let rest = import_str.strip_prefix(alias_prefix).unwrap_or("");
                            let mut resolved = format!("{}{}", target_prefix, rest);
                            if resolved.starts_with("./") {
                                resolved = resolved.strip_prefix("./").unwrap().to_string();
                            }

                            // Make it relative to workspace_root so it resolves properly in the global graph
                            if let Ok(rel) = dir.strip_prefix(&self.workspace_root) {
                                let rel_str = rel.to_string_lossy().replace('\\', "/");
                                if !rel_str.is_empty() {
                                    resolved = format!("{}/{}", rel_str, resolved);
                                }
                            }

                            return resolved;
                        }
                    }
                }
            }
            if dir == self.workspace_root {
                break;
            }
            search_dir = dir.parent();
        }

        import_str.to_string()
    }
}

#[derive(Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<ParsedNode>,
    pub edges: Vec<ParsedEdge>,
}

#[tauri::command]
pub async fn parse_codebase(app: tauri::AppHandle, path: String) -> Result<GraphData, String> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err("Path does not exist".to_string());
    }

    if let Some(scope) = app.try_fs_scope() {
        if !scope.is_allowed(path_ref) {
            return Err("Access denied by Tauri fs capability scope".to_string());
        }
    }

    let alias_resolver = AliasResolver::new(path_ref);

    let mut package_name = None;
    let pubspec_path = path_ref.join("pubspec.yaml");
    if pubspec_path.exists() {
        if let Ok(content) = fs::read_to_string(pubspec_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("name:") {
                    let parts: Vec<&str> = trimmed.split(':').collect();
                    if parts.len() >= 2 {
                        package_name = Some(parts[1].trim().to_string());
                    }
                    break;
                }
            }
        }
    }

    struct FileData {
        id: String,
        path: PathBuf,
        imports: Vec<(String, bool)>,
        is_barrel_file: bool,
        is_router: bool,
    }

    let mut files_data = Vec::new();

    for result in WalkBuilder::new(path_ref)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(|e| !is_ignored(e))
        .build()
    {
        if let Ok(entry) = result {
            let file_path = entry.path();
            if file_path.is_file() {
                let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("");
                if matches!(
                    ext,
                    "js" | "ts"
                        | "jsx"
                        | "tsx"
                        | "py"
                        | "rs"
                        | "dart"
                        | "c"
                        | "h"
                        | "cpp"
                        | "hpp"
                        | "cc"
                        | "cxx"
                        | "hxx"
                ) {
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
                        semantic_group: None,
                        summary: None,
                        metrics: None,
                    });

                    let mut imports = Vec::new();
                    let mut is_barrel_file = false;
                    let is_router = false;
                    let mut function_count = 0;

                    if let Ok(source_text) = fs::read_to_string(file_path) {
                        let re = Regex::new(
                            r"(?m)(?:^|\s)(?:function\s+\w+|=>|fn\s+\w+|def\s+\w+|class\s+\w+)",
                        )
                        .unwrap();
                        function_count = re.find_iter(&source_text).count();

                        if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                            let (barrel, _exports) =
                                extract_javascript_imports(&source_text, &file_path, &mut imports);
                            is_barrel_file = barrel;
                        } else if matches!(
                            ext,
                            "py" | "rs" | "dart" | "c" | "h" | "cpp" | "hpp" | "cc" | "cxx" | "hxx"
                        ) {
                            match ext {
                                "py" => PYTHON_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                "rs" => RUST_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                "dart" => DART_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                "c" | "h" => C_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                "cpp" | "hpp" | "cc" | "cxx" | "hxx" => CPP_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                _ => unreachable!(),
                            }
                        }
                    }

                    let import_count = imports.len();
                    let score = if function_count > 10 || import_count > 15 {
                        "High"
                    } else if function_count > 3 || import_count > 5 {
                        "Medium"
                    } else {
                        "Low"
                    };

                    if let Some(node) = nodes.last_mut() {
                        node.metrics = Some(NodeMetrics {
                            function_count,
                            import_count,
                            complexity_score: score.to_string(),
                        });
                    }

                    files_data.push(FileData {
                        id,
                        path: file_path.to_path_buf(),
                        imports,
                        is_barrel_file,
                        is_router,
                    });
                }
            }
        }
    }

    let node_index: HashMap<String, usize> = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.to_lowercase(), i))
        .collect();

    for file_data in &files_data {
        for import_str in &file_data.imports {
            if let Some(idx) = resolve_import_path(
                &file_data.path,
                path_ref,
                &import_str.0,
                package_name.as_deref(),
                &node_index,
                &nodes,
                &alias_resolver,
            ) {
                edges.push(ParsedEdge {
                    source: file_data.id.clone(),
                    target: nodes[idx].id.clone(),
                    via: None,
                    is_data_source: import_str.1,
                });
            }
        }
    }

    resolve_nextjs_edges(&nodes, &mut edges);

    let barrel_ids: Vec<String> = files_data
        .iter()
        .filter(|f| f.is_barrel_file)
        .map(|f| f.id.clone())
        .collect();

    let router_ids: Vec<String> = files_data
        .iter()
        .filter(|f| {
            let is_api_route =
                f.id.contains("/api/") || f.id.contains("route.ts") || f.id.contains("route.js");
            f.is_router || is_api_route
        })
        .map(|f| f.id.clone())
        .collect();

    let mut ids_to_bypass = barrel_ids.clone();
    ids_to_bypass.extend(router_ids.clone());

    let mut final_edges = edges;

    for bypass_id in &ids_to_bypass {
        let incoming: Vec<ParsedEdge> = final_edges
            .iter()
            .filter(|e| e.target == *bypass_id)
            .cloned()
            .collect();

        let outgoing: Vec<ParsedEdge> = final_edges
            .iter()
            .filter(|e| e.source == *bypass_id)
            .cloned()
            .collect();

        for inc in &incoming {
            for out in &outgoing {
                if inc.source != out.target {
                    let mut new_via = inc.via.clone();
                    let proxy_filename = Path::new(bypass_id)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    if new_via.is_none() {
                        new_via = Some(proxy_filename);
                    } else {
                        new_via = Some(format!("{}, {}", new_via.unwrap(), proxy_filename));
                    }

                    final_edges.push(ParsedEdge {
                        source: inc.source.clone(),
                        target: out.target.clone(),
                        via: new_via,
                        is_data_source: inc.is_data_source || out.is_data_source,
                    });
                }
            }
        }

        final_edges.retain(|e| e.source != *bypass_id && e.target != *bypass_id);
    }

    let final_nodes: Vec<ParsedNode> = nodes
        .into_iter()
        .filter(|n| !ids_to_bypass.contains(&n.id))
        .collect();

    Ok(GraphData {
        nodes: final_nodes,
        edges: final_edges,
    })
}

#[derive(Serialize, Clone)]
struct NodeUpdatedPayload {
    node: ParsedNode,
    resolved_imports: Vec<(String, bool)>,
}

#[tauri::command]
pub async fn watch_codebase(path: String, window: Window) -> Result<(), String> {
    use notify::{EventKind, RecursiveMode, Watcher};

    tauri::async_runtime::spawn(async move {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = notify::recommended_watcher(tx).unwrap();

        let path_ref = Path::new(&path);
        let _ = watcher.watch(path_ref, RecursiveMode::Recursive);

        for res in rx {
            if let Ok(event) = res {
                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                    for path_buf in event.paths {
                        if !path_buf.is_file() {
                            continue;
                        }
                        let ext = path_buf.extension().and_then(|s| s.to_str()).unwrap_or("");
                        if !matches!(
                            ext,
                            "js" | "ts"
                                | "jsx"
                                | "tsx"
                                | "py"
                                | "rs"
                                | "dart"
                                | "c"
                                | "h"
                                | "cpp"
                                | "hpp"
                                | "cc"
                                | "cxx"
                                | "hxx"
                        ) {
                            continue;
                        }

                        let id = path_buf.to_string_lossy().replace('\\', "/");
                        let label = path_buf
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();

                        let mut imports = Vec::new();
                        let mut function_count = 0;

                        if let Ok(source_text) = fs::read_to_string(&path_buf) {
                            let re = Regex::new(
                                r"(?m)(?:^|\s)(?:function\s+\w+|=>|fn\s+\w+|def\s+\w+|class\s+\w+)",
                            )
                            .unwrap();
                            function_count = re.find_iter(&source_text).count();

                            if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                                let _ = extract_javascript_imports(
                                    &source_text,
                                    &path_buf,
                                    &mut imports,
                                );
                            } else {
                                match ext {
                                    "py" => PYTHON_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    "rs" => RUST_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    "dart" => DART_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    "c" | "h" => C_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    "cpp" | "hpp" | "cc" | "cxx" | "hxx" => CPP_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    _ => {}
                                }
                            }
                        }

                        let import_count = imports.len();
                        let score = if function_count > 10 || import_count > 15 {
                            "High"
                        } else if function_count > 3 || import_count > 5 {
                            "Medium"
                        } else {
                            "Low"
                        };

                        let node = ParsedNode {
                            id: id.clone(),
                            label,
                            group: ext.to_string(),
                            semantic_group: None,
                            summary: None,
                            metrics: Some(NodeMetrics {
                                function_count,
                                import_count,
                                complexity_score: score.to_string(),
                            }),
                        };

                        let alias_resolver = AliasResolver::new(path_ref);
                        let mut resolved_imports = Vec::new();
                        for (imp, is_data) in imports {
                            let resolved = alias_resolver.resolve(&imp, &path_buf);
                            let clean = resolved
                                .strip_prefix("@/")
                                .or_else(|| resolved.strip_prefix("~/"))
                                .unwrap_or(&resolved);
                            resolved_imports.push((clean.to_string(), is_data));
                        }

                        let _ = window.emit(
                            "node_updated",
                            NodeUpdatedPayload {
                                node,
                                resolved_imports,
                            },
                        );
                    }
                }
            }
        }
    });

    Ok(())
}
