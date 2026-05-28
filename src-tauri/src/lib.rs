use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;
use oxc_ast::ast::ModuleDeclaration;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

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

    for entry in WalkDir::new(path_ref)
        .into_iter()
        .filter_entry(|e| !is_ignored(e))
        .filter_map(|e| e.ok())
    {
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
                    let allocator = Allocator::default();
                    let source_type = SourceType::from_path(file_path).unwrap_or_default().with_module(true);
                    let ret = Parser::new(&allocator, &source_text, source_type).parse();

                    for stmt in &ret.program.body {
                        if let Some(decl) = stmt.as_module_declaration() {
                            if let ModuleDeclaration::ImportDeclaration(import_decl) = decl {
                                imports.push(import_decl.source.value.to_string());
                            }
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

    // Resolve imports to create edges
    for file_data in &files_data {
        let dir = file_data.path.parent().unwrap_or(Path::new(""));
        
        for import_str in &file_data.imports {
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
                        break;
                    }
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
