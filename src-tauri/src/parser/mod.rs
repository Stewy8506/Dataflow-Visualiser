pub mod cmake;
pub mod cpp;
pub mod csharp;
pub mod dart;
pub mod go;
pub mod graph_builder;
pub mod java;
pub mod javascript;
pub mod nextjs;
pub mod props;
pub mod python;
pub mod rust;
pub mod tree_sitter_utils;
pub mod unused_exports;
pub mod utils;

use ignore::WalkBuilder;
use rayon::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Window};

use cpp::{CPP_PARSER, C_PARSER};
use dart::DART_PARSER;
use go::GO_PARSER;
use java::JAVA_PARSER;
use javascript::extract_javascript_imports;

use csharp::CSHARP_PARSER;
use python::PYTHON_PARSER;
use rust::RUST_PARSER;
use tree_sitter_utils::extract_imports_with_parser;
use utils::is_ignored;

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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unused_exports: Vec<String>,
    #[serde(default)]
    pub metrics: Option<NodeMetrics>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub vulnerabilities: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedEdge {
    pub source: String,
    pub target: String,
    pub via: Option<String>,
    pub is_data_source: bool,
}

pub struct FileData {
    pub id: String,
    pub path: PathBuf,
    pub imports: Vec<(String, bool)>,
    pub api_calls: Vec<String>,
    pub api_endpoints: Vec<String>,
    pub exported_symbols: Vec<String>,
    pub import_specifiers: Vec<(String, String)>,
    pub is_barrel_file: bool,
    pub is_router: bool,
    #[allow(dead_code)]
    pub tags: Vec<String>,
    pub express_routes: Vec<(String, String)>,
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
pub async fn parse_codebase(
    _app: tauri::AppHandle,
    path: String,
) -> Result<GraphData, crate::error::AppError> {
    let mut nodes = Vec::new();
    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err(crate::error::AppError::PathNotFound(path.clone()));
    }

    let alias_resolver = AliasResolver::new(path_ref);

    let mut package_name = None;
    let pubspec_path = path_ref.join("pubspec.yaml");
    let is_flutter = pubspec_path.exists();

    let mut filter_mobile_platforms = is_flutter;
    if !filter_mobile_platforms {
        let package_json_path = path_ref.join("package.json");
        if package_json_path.exists() {
            if let Ok(content) = fs::read_to_string(&package_json_path) {
                if content.contains("\"react-native\"") {
                    filter_mobile_platforms = true;
                }
            }
        }
    }

    if is_flutter {
        if let Ok(content) = fs::read_to_string(&pubspec_path) {
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

    let mut ext_deps: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if !is_flutter {
        let package_json_path = path_ref.join("package.json");
        let package_lock_path = path_ref.join("package-lock.json");

        if package_json_path.exists() {
            if let Ok(content) = fs::read_to_string(&package_json_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(deps) = json.get("dependencies").and_then(|v| v.as_object()) {
                        for (k, v) in deps {
                            let ver = v.as_str().unwrap_or("").replace("^", "").replace("~", "");
                            ext_deps.insert(k.clone(), ver);
                        }
                    }
                    if let Some(deps) = json.get("devDependencies").and_then(|v| v.as_object()) {
                        for (k, v) in deps {
                            let ver = v.as_str().unwrap_or("").replace("^", "").replace("~", "");
                            ext_deps.insert(k.clone(), ver);
                        }
                    }
                }
            }
        }

        // Overwrite with precise lockfile versions if possible
        if package_lock_path.exists() {
            if let Ok(content) = fs::read_to_string(&package_lock_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(packages) = json.get("packages").and_then(|v| v.as_object()) {
                        for (key, val) in packages {
                            if key.starts_with("node_modules/") {
                                let pkg_name = key.replace("node_modules/", "");
                                if ext_deps.contains_key(&pkg_name) {
                                    if let Some(ver) = val.get("version").and_then(|v| v.as_str()) {
                                        ext_deps.insert(pkg_name, ver.to_string());
                                    }
                                }
                            }
                        }
                    } else if let Some(dependencies) =
                        json.get("dependencies").and_then(|v| v.as_object())
                    {
                        for (key, val) in dependencies {
                            if ext_deps.contains_key(key) {
                                if let Some(ver) = val.get("version").and_then(|v| v.as_str()) {
                                    ext_deps.insert(key.clone(), ver.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        let pubspec_lock_path = path_ref.join("pubspec.lock");
        if let Ok(content) = fs::read_to_string(&pubspec_path) {
            let mut in_deps = false;
            for line in content.lines() {
                let trimmed = line.trim();
                if line.starts_with("dependencies:") || line.starts_with("dev_dependencies:") {
                    in_deps = true;
                } else if !line.starts_with(' ') && !line.is_empty() {
                    in_deps = false;
                } else if in_deps && !trimmed.is_empty() && !trimmed.starts_with('#') {
                    let parts: Vec<&str> = trimmed.split(':').collect();
                    if !parts.is_empty() {
                        ext_deps.insert(parts[0].trim().to_string(), "".to_string());
                    }
                }
            }
        }

        // Parse pubspec.lock manually
        if pubspec_lock_path.exists() {
            if let Ok(content) = fs::read_to_string(&pubspec_lock_path) {
                let mut current_pkg = String::new();
                for line in content.lines() {
                    let trimmed = line.trim();
                    if line.starts_with("  ") && !line.starts_with("    ") && trimmed.ends_with(':')
                    {
                        current_pkg = trimmed[..trimmed.len() - 1].to_string();
                    } else if line.starts_with("    version:")
                        && ext_deps.contains_key(&current_pkg)
                    {
                        let parts: Vec<&str> = trimmed.split(':').collect();
                        if parts.len() >= 2 {
                            let ver = parts[1].trim().replace("\"", "");
                            ext_deps.insert(current_pkg.clone(), ver);
                        }
                    }
                }
            }
        }
    }

    // OSV Lookup
    let mut vulnerabilities_map: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();

    // We only perform the OSV check if we have actual deps to check to save time
    if !ext_deps.is_empty() {
        let ecosystem = if is_flutter { "Pub" } else { "npm" };
        let mut queries = Vec::new();

        for (pkg, ver) in &ext_deps {
            if !ver.is_empty() {
                queries.push(serde_json::json!({
                    "package": { "name": pkg, "ecosystem": ecosystem },
                    "version": ver
                }));
            }
        }

        if !queries.is_empty() {
            let req_body = serde_json::json!({ "queries": queries });
            let client = reqwest::Client::new();
            if let Ok(resp) = client
                .post("https://api.osv.dev/v1/querybatch")
                .json(&req_body)
                .send()
                .await
            {
                if let Ok(json_resp) = resp.json::<serde_json::Value>().await {
                    if let Some(results) = json_resp.get("results").and_then(|r| r.as_array()) {
                        let mut i = 0;
                        for (pkg, _ver) in ext_deps.iter().filter(|(_, v)| !v.is_empty()) {
                            if let Some(res) = results.get(i) {
                                if let Some(vulns) = res.get("vulns").and_then(|v| v.as_array()) {
                                    let mut v_list = Vec::new();
                                    for vuln in vulns {
                                        if let Some(id) = vuln.get("id").and_then(|i| i.as_str()) {
                                            v_list.push(id.to_string());
                                        }
                                    }
                                    if !v_list.is_empty() {
                                        vulnerabilities_map.insert(pkg.clone(), v_list);
                                    }
                                }
                            }
                            i += 1;
                        }
                    }
                }
            }
        }
    }

    for (dep, _) in &ext_deps {
        let vulns = vulnerabilities_map.get(dep).cloned().unwrap_or_default();
        nodes.push(ParsedNode {
            id: format!("ext:{}", dep),
            label: dep.clone(),
            group: if is_flutter {
                "pub".to_string()
            } else {
                "npm".to_string()
            },
            semantic_group: None,
            summary: None,
            unused_exports: Vec::new(),
            metrics: None,
            tags: Vec::new(),
            vulnerabilities: vulns,
        });
    }

    let mut paths_to_parse = Vec::new();
    for result in WalkBuilder::new(path_ref)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(move |e| !is_ignored(e, filter_mobile_platforms))
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
                        | "java"
                        | "cs"
                        | "go"
                ) {
                    paths_to_parse.push(file_path.to_path_buf());
                }
            }
        }
    }

    let parsed_results: Vec<(ParsedNode, FileData)> = paths_to_parse
        .into_par_iter()
        .map(|file_path| {
            let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("");
            let id = file_path.to_string_lossy().replace('\\', "/");
            let label = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let mut node = ParsedNode {
                id: id.clone(),
                label,
                group: ext.to_string(),
                semantic_group: None,
                summary: None,
                unused_exports: Vec::new(),
                metrics: None,
                tags: Vec::new(),
                vulnerabilities: Vec::new(),
            };

            let mut imports = Vec::new();
            let mut api_calls = Vec::new();
            let mut api_endpoints = Vec::new();
            let mut exported_symbols = Vec::new();
            let mut import_specifiers = Vec::new();
            let mut is_barrel_file = false;
            let is_router = false;
            let mut function_count = 0;
            let mut tags = Vec::new();
            let mut express_routes = Vec::new();

            if let Ok(source_text) = fs::read_to_string(&file_path) {
                let re =
                    Regex::new(r"(?m)(?:^|\s)(?:function\s+\w+|=>|fn\s+\w+|def\s+\w+|class\s+\w+)")
                        .unwrap();
                function_count = re.find_iter(&source_text).count();

                if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                    let (barrel, _exports, extracted_tags, extracted_routes) =
                        extract_javascript_imports(
                            &source_text,
                            &file_path,
                            &mut imports,
                            &mut api_calls,
                            &mut exported_symbols,
                            &mut import_specifiers,
                        );
                    is_barrel_file = barrel;
                    tags.extend(extracted_tags);
                    express_routes.extend(extracted_routes);
                } else if matches!(
                    ext,
                    "py" | "rs"
                        | "dart"
                        | "c"
                        | "h"
                        | "cpp"
                        | "hpp"
                        | "cc"
                        | "cxx"
                        | "hxx"
                        | "java"
                        | "cs"
                        | "go"
                ) {
                    match ext {
                        "py" => PYTHON_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "rs" => RUST_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "dart" => DART_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "c" | "h" => C_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "cpp" | "hpp" | "cc" | "cxx" | "hxx" => CPP_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "java" => JAVA_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "cs" => CSHARP_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
                            );
                        }),
                        "go" => GO_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut api_endpoints,
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

            node.metrics = Some(NodeMetrics {
                function_count,
                import_count,
                complexity_score: score.to_string(),
            });

            let file_data = FileData {
                id,
                path: file_path,
                imports,
                api_calls,
                api_endpoints,
                exported_symbols,
                import_specifiers,
                is_barrel_file,
                is_router,
                tags: tags.clone(),
                express_routes,
            };

            (node, file_data)
        })
        .collect();

    let mut files_data = Vec::with_capacity(parsed_results.len());
    for (node, file_data) in parsed_results {
        nodes.push(node);
        files_data.push(file_data);
    }

    let node_index: HashMap<String, usize> = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.to_lowercase(), i))
        .collect();

    let cmake_data = cmake::parse_cmake_projects(path_ref);

    let ext_deps_set: std::collections::HashSet<String> = ext_deps.keys().cloned().collect();

    Ok(graph_builder::build_graph(
        &files_data,
        nodes,
        path_ref,
        package_name.as_deref(),
        &node_index,
        &alias_resolver,
        &cmake_data,
        &ext_deps_set,
    ))
}

#[derive(Serialize, Clone)]
struct NodeUpdatedPayload {
    node: ParsedNode,
    resolved_imports: Vec<(String, bool)>,
}

#[tauri::command]
pub async fn watch_codebase(path: String, window: Window) -> Result<(), crate::error::AppError> {
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
                        let mut api_calls = Vec::new();
                        let mut api_endpoints = Vec::new();
                        let mut function_count = 0;

                        if let Ok(source_text) = fs::read_to_string(&path_buf) {
                            let re = Regex::new(
                                r"(?m)(?:^|\s)(?:function\s+\w+|=>|fn\s+\w+|def\s+\w+|class\s+\w+)",
                            )
                            .unwrap();
                            function_count = re.find_iter(&source_text).count();

                            if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                                let mut exported_symbols = Vec::new();
                                let mut import_specifiers = Vec::new();
                                let _ = extract_javascript_imports(
                                    &source_text,
                                    &path_buf,
                                    &mut imports,
                                    &mut api_calls,
                                    &mut exported_symbols,
                                    &mut import_specifiers,
                                );
                            } else {
                                match ext {
                                    "py" => PYTHON_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                            &mut api_endpoints,
                                        )
                                    }),
                                    "rs" => RUST_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                            &mut api_endpoints,
                                        )
                                    }),
                                    "dart" => DART_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                            &mut api_endpoints,
                                        )
                                    }),
                                    "c" | "h" => C_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                            &mut api_endpoints,
                                        )
                                    }),
                                    "cpp" | "hpp" | "cc" | "cxx" | "hxx" => CPP_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                            &mut api_endpoints,
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
                            unused_exports: Vec::new(),
                            metrics: Some(NodeMetrics {
                                function_count,
                                import_count,
                                complexity_score: score.to_string(),
                            }),
                            tags: Vec::new(),
                            vulnerabilities: Vec::new(),
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
