use ignore::{DirEntry, WalkBuilder};
use oxc_allocator::Allocator;
use oxc_ast::ast::{ModuleDeclaration, ImportDeclarationSpecifier};
use oxc_parser::Parser;
use oxc_span::SourceType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Window};
use tree_sitter::Parser as TSParser;

// Thread-local parsers: constructed once per thread, reused across files.
thread_local! {
    static PYTHON_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_python::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
    static RUST_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_rust::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
    static DART_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_dart::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
}

fn extract_imports_with_parser(
    parser: &mut TSParser,
    source_text: &str,
    ext: &str,
    imports: &mut Vec<(String, bool)>
) {
    if let Some(tree) = parser.parse(source_text, None) {
        let mut cursor = tree.walk();
        let mut reached_root = false;
        while !reached_root {
            let node = cursor.node();
            let kind = node.kind();

            let mut target_node = None;
            if ext == "py" && (kind == "import_statement" || kind == "import_from_statement") {
                target_node = Some(node);
            } else if ext == "rs" && kind == "use_declaration" {
                target_node = Some(node);
            } else if ext == "dart" && kind == "import_or_export" {
                target_node = Some(node);
            }

            if let Some(n) = target_node {
                if let Ok(text) = n.utf8_text(source_text.as_bytes()) {
                    let clean = text
                        .replace("import ", "")
                        .replace("from ", "")
                        .replace("use ", "")
                        .replace(';', "")
                        .replace('\'', "")
                        .replace('"', "");
                    let parts: Vec<&str> = clean.split_whitespace().collect();
                    if parts.len() >= 2 {
                        // e.g. from .utils import math -> push both ".utils/math" and ".utils"
                        imports.push((format!("{}/{}", parts[0], parts[1]), false));
                        imports.push((parts[0].to_string(), false));
                    } else if let Some(module) = parts.first() {
                        imports.push((module.to_string(), false));
                    }
                }
            }

            if cursor.goto_first_child() { continue; }
            if cursor.goto_next_sibling() { continue; }
            let mut retracing = true;
            while retracing {
                if !cursor.goto_parent() {
                    retracing = false;
                    reached_root = true;
                } else if cursor.goto_next_sibling() {
                    retracing = false;
                }
            }
        }
    }
}

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

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedNode {
    pub id: String,
    pub label: String,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedEdge {
    pub source: String,
    pub target: String,
    pub via: Option<String>,
    pub is_data_source: bool,
}

#[derive(Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<ParsedNode>,
    pub edges: Vec<ParsedEdge>,
}

fn resolve_import_path(
    current_file_path: &Path,
    workspace_root: &Path,
    import_str: &str,
    package_name: Option<&str>,
    node_index: &HashMap<String, usize>,
    nodes: &[ParsedNode],
) -> Option<usize> {
    // 1. Clean import path
    let mut import_path = import_str.replace('\\', "/");

    // 2. Handle Dart package imports (e.g., package:my_project/src/utils/math.dart)
    if import_path.starts_with("package:") {
        if let Some(pkg) = package_name {
            let prefix = format!("package:{}/", pkg);
            if import_path.starts_with(&prefix) {
                // Local Dart package import! Maps to lib/src/utils/math.dart
                let sub_path = import_path.strip_prefix(&prefix).unwrap();
                import_path = format!("lib/{}", sub_path);
            } else {
                return None; // External package
            }
        } else {
            return None; // Unknown package name
        }
    }

    // 3. Handle Rust crate imports (use crate::utils::math -> src/utils/math)
    if import_path.starts_with("crate::") {
        let sub_path = import_path.strip_prefix("crate::").unwrap().replace("::", "/");
        import_path = format!("src/{}", sub_path);
    }

    // 4. Handle Rust super:: / self:: imports
    let mut clean_import = import_path
        .replace("super::", "../")
        .replace("self::", "./")
        .replace("::", "/");

    // 5. Handle Python dot imports
    if clean_import.starts_with('.') && (clean_import.ends_with(".py") || current_file_path.extension().and_then(|s| s.to_str()) == Some("py")) {
        let dots_count = clean_import.chars().take_while(|c| *c == '.').count();
        let path_part = &clean_import[dots_count..];
        let relative_prefix = "../".repeat(dots_count - 1) + if dots_count == 1 { "./" } else { "" };
        clean_import = format!("{}{}", relative_prefix, path_part.replace('.', "/"));
    } else if current_file_path.extension().and_then(|s| s.to_str()) == Some("py") {
        clean_import = clean_import.replace('.', "/");
    }

    let clean_import = clean_import
        .strip_prefix("@/")
        .or_else(|| clean_import.strip_prefix("~/"))
        .unwrap_or(&clean_import);

    // Candidates checklist
    let mut candidates = Vec::new();

    // Candidate A: Relative path (if starts with .)
    if clean_import.starts_with('.') {
        if let Some(dir) = current_file_path.parent() {
            let resolved = normalize_path(&dir.join(clean_import));
            candidates.push(resolved);
        }
    } else {
        // Candidate B: Relative to workspace root directly
        candidates.push(workspace_root.join(clean_import));
        // Candidate C: Relative to workspace_root/src/
        candidates.push(workspace_root.join("src").join(clean_import));
        // Candidate D: Relative to workspace_root/lib/
        candidates.push(workspace_root.join("lib").join(clean_import));
    }

    const ALL_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "py", "rs", "dart"];

    // Probe candidates
    for base in &candidates {
        // Try direct file path
        if let Some(idx) = check_node_existence(base, node_index) {
            return Some(idx);
        }

        // Try with extensions
        for ext in ALL_EXTENSIONS {
            let with_ext = base.with_extension(*ext);
            if let Some(idx) = check_node_existence(&with_ext, node_index) {
                return Some(idx);
            }
        }

        // Try as directory (e.g., dir/index.ext or dir/mod.rs)
        for ext in ALL_EXTENSIONS {
            let index_file = base.join(format!("index.{}", ext));
            if let Some(idx) = check_node_existence(&index_file, node_index) {
                return Some(idx);
            }
            let mod_file = base.join(format!("mod.{}", ext));
            if let Some(idx) = check_node_existence(&mod_file, node_index) {
                return Some(idx);
            }
        }
    }

    // 6. Suffix match fallback (O(N) search over all nodes, safe fallback)
    let clean_lower = clean_import.to_lowercase();
    for (i, node) in nodes.iter().enumerate() {
        let node_id_lower = node.id.to_lowercase();
        for ext in ALL_EXTENSIONS {
            let suffix_file = format!("/{}.{}", clean_lower, ext);
            let suffix_dir = format!("/{}/index.{}", clean_lower, ext);
            let suffix_mod = format!("/{}/mod.{}", clean_lower, ext);
            if node_id_lower.ends_with(&suffix_file)
                || node_id_lower.ends_with(&suffix_dir)
                || node_id_lower.ends_with(&suffix_mod)
                || node_id_lower.ends_with(&format!("/{}", clean_lower))
            {
                return Some(i);
            }
        }
    }

    None
}

fn check_node_existence(path: &Path, node_index: &HashMap<String, usize>) -> Option<usize> {
    let key = path.to_string_lossy().replace('\\', "/").to_lowercase();
    node_index.get(&key).copied()
}

#[tauri::command]
async fn parse_codebase(path: String) -> Result<GraphData, String> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err("Path does not exist".to_string());
    }

    // Try to extract Dart package name from pubspec.yaml for Flutter support
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
        is_router: bool,
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
                if matches!(ext, "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "dart") {
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
                    });

                    let mut imports = Vec::new();
                    let mut is_router = false;

                    if let Ok(source_text) = fs::read_to_string(file_path) {
                        if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                            let allocator = Allocator::default();
                            let source_type = SourceType::from_path(file_path).unwrap_or_default();
                            let ret = Parser::new(&allocator, &source_text, source_type).parse();

                            if ret.errors.is_empty() {
                                let program = ret.program;
                                let mut all_exports_imports = true;
                                let mut has_exports = false;

                                for stmt in &program.body {
                                    if let Some(decl) = stmt.as_module_declaration() {
                                        match decl {
                                            ModuleDeclaration::ImportDeclaration(import_decl) => {
                                                let source = import_decl.source.value.to_string();
                                                let mut local_names = Vec::new();
                                                if let Some(specifiers) = &import_decl.specifiers {
                                                    for spec in specifiers {
                                                        match spec {
                                                            ImportDeclarationSpecifier::ImportSpecifier(s) => {
                                                                local_names.push(s.local.name.to_string());
                                                            }
                                                            ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                                                                local_names.push(s.local.name.to_string());
                                                            }
                                                            ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                                                                local_names.push(s.local.name.to_string());
                                                            }
                                                        }
                                                    }
                                                }

                                                let mut is_data_source = false;
                                                for name in local_names {
                                                    let jsx_pattern = format!("<{}", name);
                                                    let call_pattern = format!("{}(", name);
                                                    let call_pattern_space = format!("{} (", name);

                                                    if (source_text.contains(&call_pattern) || source_text.contains(&call_pattern_space)) && !source_text.contains(&jsx_pattern) {
                                                        is_data_source = true;
                                                        break;
                                                    }
                                                }

                                                imports.push((source, is_data_source));
                                            }
                                            ModuleDeclaration::ExportAllDeclaration(_) => {
                                                has_exports = true;
                                            }
                                            ModuleDeclaration::ExportNamedDeclaration(named) => {
                                                if named.source.is_some() {
                                                    has_exports = true;
                                                } else {
                                                    all_exports_imports = false;
                                                }
                                            }
                                            ModuleDeclaration::ExportDefaultDeclaration(_) => {
                                                all_exports_imports = false;
                                            }
                                            _ => {
                                                all_exports_imports = false;
                                            }
                                        }
                                    } else {
                                        all_exports_imports = false;
                                    }
                                }

                                // It's a router if it purely handles imports/exports and doesn't contain component logic
                                if all_exports_imports && has_exports {
                                    is_router = true;
                                }
                            }
                        } else if matches!(ext, "py" | "rs" | "dart") {
                            match ext {
                                "py" => PYTHON_PARSER.with(|p| {
                                    extract_imports_with_parser(&mut p.borrow_mut(), &source_text, ext, &mut imports);
                                }),
                                "rs" => RUST_PARSER.with(|p| {
                                    extract_imports_with_parser(&mut p.borrow_mut(), &source_text, ext, &mut imports);
                                }),
                                "dart" => DART_PARSER.with(|p| {
                                    extract_imports_with_parser(&mut p.borrow_mut(), &source_text, ext, &mut imports);
                                }),
                                _ => unreachable!(),
                            }
                        }
                    }

                    files_data.push(FileData {
                        id,
                        path: file_path.to_path_buf(),
                        imports,
                        is_router,
                    });
                }
            }
        }
    }

    // ── Build O(1) lookup structures before edge resolution ──────────────────
    // node_index: lowercase id → index in `nodes`
    let node_index: HashMap<String, usize> = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.to_lowercase(), i))
        .collect();

    // Resolve imports to create edges
    for file_data in &files_data {
        for import_str in &file_data.imports {
            if let Some(idx) = resolve_import_path(
                &file_data.path,
                path_ref,
                &import_str.0,
                package_name.as_deref(),
                &node_index,
                &nodes,
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

    // Next.js Implicit Routing Connections
    let is_nextjs = nodes.iter().any(|n| n.label.starts_with("layout.") || n.label.starts_with("page."));
    
    if is_nextjs {
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
                let dir_str = dir.to_string_lossy().replace('\\', "/").to_lowercase();

                if let Some(l) = layout_nodes.iter().find(|l| {
                    Path::new(&l.id)
                        .parent()
                        .map(|p| p.to_string_lossy().replace('\\', "/").to_lowercase())
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
                    via: None,
                    is_data_source: false, // Layout -> Route is a control flow
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
                    let dir_str = dir.to_string_lossy().replace('\\', "/").to_lowercase();
                    if let Some(parent_l) = layout_nodes.iter().find(|l| {
                        Path::new(&l.id)
                            .parent()
                            .map(|p| p.to_string_lossy().replace('\\', "/").to_lowercase())
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
                            via: None,
                            is_data_source: false, // Parent Layout -> Child Layout
                        });
                    }
                }
            }
        }
    }

    // Graph Reduction: Collapse Router Nodes and API Routes
    let router_ids: Vec<String> = files_data
        .iter()
        .filter(|f| {
            let is_api_route = f.id.contains("/api/") || f.id.contains("route.ts") || f.id.contains("route.js");
            f.is_router || is_api_route
        })
        .map(|f| f.id.clone())
        .collect();

    let mut final_edges = edges;

    for router_id in &router_ids {
        let incoming: Vec<ParsedEdge> = final_edges
            .iter()
            .filter(|e| e.target == *router_id)
            .cloned()
            .collect();

        let outgoing: Vec<ParsedEdge> = final_edges
            .iter()
            .filter(|e| e.source == *router_id)
            .cloned()
            .collect();

        for inc in &incoming {
            for out in &outgoing {
                if inc.source != out.target {
                    let mut new_via = inc.via.clone();
                    let router_filename = Path::new(router_id)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    if new_via.is_none() {
                        new_via = Some(router_filename);
                    } else {
                        new_via = Some(format!("{}, {}", new_via.unwrap(), router_filename));
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

        final_edges.retain(|e| e.source != *router_id && e.target != *router_id);
    }

    let final_nodes: Vec<ParsedNode> = nodes
        .into_iter()
        .filter(|n| !router_ids.contains(&n.id))
        .collect();

    Ok(GraphData {
        nodes: final_nodes,
        edges: final_edges,
    })
}

#[derive(Serialize)]
struct GeminiRequestPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiRequestContent {
    parts: Vec<GeminiRequestPart>,
}

#[derive(Serialize)]
struct GenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiRequestContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Deserialize)]
struct GeminiResponseCandidate {
    content: GeminiResponseContent,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiResponseCandidate>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AiNodeResult {
    id: String,
    semantic_group: String,
    summary: String,
}

#[derive(Deserialize)]
struct AiResult {
    nodes: Vec<AiNodeResult>,
}

#[tauri::command]
async fn enrich_graph_with_ai(
    window: Window,
    graph_data: GraphData,
    api_key: String,
    model: String,
) -> Result<(), String> {
    if api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let chunk_size = 10;
        
        let nodes = graph_data.nodes.clone();
        
        for chunk in nodes.chunks(chunk_size) {
            let mut prompt = String::from(
                "You are an expert software architect. Analyze the provided codebase files and group them into semantic domains.\n\
                Also, provide a short 1-2 sentence summary for each file.\n\n\
                Return the result as a JSON object with the following schema:\n\
                {\n\
                  \"nodes\": [\n\
                    {\n\
                      \"id\": \"file id (exact string match from input)\",\n\
                      \"semantic_group\": \"A short category name (e.g., 'Authentication', 'UI Components', 'Database', 'API Routes')\",\n\
                      \"summary\": \"Short explanation of what the file does\"\n\
                    }\n\
                  ]\n\
                }\n\n\
                Only return the JSON. Do not include markdown formatting or explanations.\n\n\
                Input Nodes:\n",
            );

            for node in chunk {
                prompt.push_str(&format!("File ID: {}\n", node.id));
                prompt.push_str(&format!("File Name: {}\n", node.label));
                prompt.push_str("Content:\n```\n");
                if let Ok(content) = fs::read_to_string(&node.id) {
                    let truncated = content.lines().take(50).collect::<Vec<_>>().join("\n");
                    prompt.push_str(&truncated);
                } else {
                    prompt.push_str("// Could not read file content");
                }
                prompt.push_str("\n```\n\n");
            }

            // `model` is expected to be in the format "models/gemini-1.5-flash"
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
                model, api_key
            );

            let request_body = GeminiRequest {
                contents: vec![GeminiRequestContent {
                    parts: vec![GeminiRequestPart { text: prompt }],
                }],
                generation_config: GenerationConfig {
                    response_mime_type: "application/json".to_string(),
                },
            };

            let response = client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await;

            if let Ok(resp) = response {
                if let Ok(response_text) = resp.text().await {
                    if let Ok(gemini_response) = serde_json::from_str::<GeminiResponse>(&response_text) {
                        if let Some(candidate) = gemini_response.candidates.first() {
                            if let Some(part) = candidate.content.parts.first() {
                                let text = part.text.trim();
                                
                                // Robust JSON extraction:
                                let json_str = if let Some(start) = text.find("```json") {
                                    if let Some(end) = text[start + 7..].find("```") {
                                        &text[start + 7..start + 7 + end]
                                    } else {
                                        &text[start + 7..]
                                    }
                                } else if let Some(start) = text.find('{') {
                                    if let Some(end) = text.rfind('}') {
                                        &text[start..=end]
                                    } else {
                                        text
                                    }
                                } else {
                                    text
                                };
                                
                                let json_str = json_str.trim();

                                if let Ok(ai_result) = serde_json::from_str::<AiResult>(json_str) {
                                    let _ = window.emit("ai_nodes_enriched", &ai_result.nodes);
                                } else {
                                    eprintln!("Failed to parse AI JSON result: {}", json_str);
                                }
                            }
                        }
                    } else {
                        eprintln!("Failed to parse Gemini response: {}", response_text);
                    }
                }
            }
        }
        let _ = window.emit("ai_enrichment_complete", ());
    });

    Ok(())
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            parse_codebase,
            enrich_graph_with_ai,
            delete_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
