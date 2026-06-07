pub mod core;
pub mod languages;
pub mod utils;

use ignore::WalkBuilder;
use rayon::prelude::*;
use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::{Emitter, Window};

use languages::cpp::{CPP_PARSER, C_PARSER};
use languages::csharp::CSHARP_PARSER;
use languages::dart::DART_PARSER;
use languages::go::GO_PARSER;
use languages::java::JAVA_PARSER;
use languages::javascript::extract_javascript_imports;
use languages::python::PYTHON_PARSER;
use languages::rust::RUST_PARSER;

use utils::tree_sitter_utils::extract_imports_with_parser;
use utils::utils::is_ignored;

pub use core::models::{FileData, GraphData, NodeMetrics, ParsedEdge, ParsedNode};
pub use utils::alias::AliasResolver;

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
    } else {
        let go_mod_path = path_ref.join("go.mod");
        if go_mod_path.exists() {
            if let Ok(content) = fs::read_to_string(&go_mod_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("module ") {
                        let parts: Vec<&str> = trimmed.split_whitespace().collect();
                        if parts.len() >= 2 {
                            package_name = Some(parts[1].trim().to_string());
                        }
                        break;
                    }
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
                                if let std::collections::hash_map::Entry::Occupied(mut e) = ext_deps.entry(pkg_name) {
                                    if let Some(ver) = val.get("version").and_then(|v| v.as_str()) {
                                        e.insert(ver.to_string());
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

        let go_mod_path = path_ref.join("go.mod");
        let go_sum_path = path_ref.join("go.sum");

        if go_mod_path.exists() {
            if let Ok(content) = fs::read_to_string(&go_mod_path) {
                let mut in_require = false;
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("require (") {
                        in_require = true;
                    } else if trimmed.starts_with("require ") {
                        let parts: Vec<&str> = trimmed.split_whitespace().collect();
                        if parts.len() >= 3 {
                            ext_deps.insert(parts[1].to_string(), parts[2].to_string());
                        }
                    } else if trimmed == ")" {
                        in_require = false;
                    } else if in_require && !trimmed.is_empty() && !trimmed.starts_with("//") {
                        let parts: Vec<&str> = trimmed.split_whitespace().collect();
                        if parts.len() >= 2 {
                            ext_deps.insert(parts[0].to_string(), parts[1].to_string());
                        }
                    }
                }
            }
        }

        if go_sum_path.exists() {
            if let Ok(content) = fs::read_to_string(&go_sum_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let pkg = parts[0].to_string();
                        let ver = parts[1].split('/').next().unwrap_or(parts[1]).to_string();
                        if ext_deps.contains_key(&pkg) {
                            ext_deps.insert(pkg, ver);
                        }
                    }
                }
            }
        }
    }

    let vulnerabilities_map = utils::osv::check_vulnerabilities(&ext_deps, is_flutter).await;

    for dep in ext_deps.keys() {
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
    for entry in WalkBuilder::new(path_ref)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(move |e| !is_ignored(e, filter_mobile_platforms))
        .build().flatten()
    {
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
            let mut custom_edges = Vec::new();
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
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "rs" => RUST_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "dart" => DART_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "c" | "h" => C_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "cpp" | "hpp" | "cc" | "cxx" | "hxx" => CPP_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "java" => JAVA_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "cs" => CSHARP_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
                                &mut api_endpoints,
                            );
                        }),
                        "go" => GO_PARSER.with(|p| {
                            extract_imports_with_parser(
                                &mut p.borrow_mut(),
                                &source_text,
                                ext,
                                &mut imports,
                                &mut custom_edges,
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
                custom_edges,
                api_calls,
                api_endpoints,
                exported_symbols,
                import_specifiers,
                is_barrel_file,
                is_router,
                tags: tags.clone(),
                express_routes,
            };

            node.tags = tags;

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

    let cmake_data = languages::cmake::parse_cmake_projects(path_ref);
    let cargo_data = languages::cargo::parse_cargo_workspaces(path_ref);

    let ext_deps_set: std::collections::HashSet<String> = ext_deps.keys().cloned().collect();

    Ok(core::graph_builder::build_graph(
        &files_data,
        nodes,
        path_ref,
        package_name.as_deref(),
        &node_index,
        &alias_resolver,
        &cmake_data,
        &cargo_data,
        &ext_deps_set,
    ))
}

#[derive(Serialize, Clone)]
struct NodeUpdatedPayload {
    node: ParsedNode,
    resolved_imports: Vec<(String, bool)>,
    resolved_custom_edges: Vec<(String, String)>,
}

#[tauri::command]
pub async fn watch_codebase(path: String, window: Window) -> Result<(), crate::error::AppError> {
    use notify::{EventKind, RecursiveMode, Watcher};

    tauri::async_runtime::spawn(async move {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = notify::recommended_watcher(tx).unwrap();

        let path_ref = Path::new(&path);
        let _ = watcher.watch(path_ref, RecursiveMode::Recursive);

        for event in rx.into_iter().flatten() {
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
                            | "go"
                            | "java"
                            | "cs"
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
                    let mut custom_edges = Vec::new();
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
                                        &mut custom_edges,
                                        &mut api_endpoints,
                                    )
                                }),
                                "rs" => RUST_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                        &mut custom_edges,
                                        &mut api_endpoints,
                                    )
                                }),
                                "dart" => DART_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                        &mut custom_edges,
                                        &mut api_endpoints,
                                    )
                                }),
                                "c" | "h" => C_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                        &mut custom_edges,
                                        &mut api_endpoints,
                                    )
                                }),
                                "cpp" | "hpp" | "cc" | "cxx" | "hxx" => CPP_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                        &mut custom_edges,
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

                    let mut resolved_custom_edges = Vec::new();
                    for (tgt, etype) in custom_edges {
                        resolved_custom_edges.push((tgt, etype));
                    }

                    let _ = window.emit(
                        "node_updated",
                        NodeUpdatedPayload {
                            node,
                            resolved_imports,
                            resolved_custom_edges,
                        },
                    );
                }
            }
        }
    });

    Ok(())
}
