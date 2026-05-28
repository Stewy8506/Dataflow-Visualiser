use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;
use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

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

    for entry in WalkDir::new(path_ref)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let file_path = entry.path();
        if file_path.is_file() {
            let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext == "js" || ext == "ts" || ext == "jsx" || ext == "tsx" {
                let id = file_path.to_string_lossy().to_string();
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

                if let Ok(source_text) = fs::read_to_string(file_path) {
                    let allocator = Allocator::default();
                    let source_type = SourceType::from_path(file_path).unwrap_or_default();
                    let ret = Parser::new(&allocator, &source_text, source_type).parse();
                    
                    // A simple heuristic for imports without deep AST visitation
                    for stmt in &ret.program.body {
                        // The AST can be inspected for dependencies here
                        // For demonstration, we'll leave deep import resolution to the next iteration
                        // and just prove oxc is successfully parsing the file.
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

