use std::collections::HashSet;
use std::path::Path;
use regex::Regex;

use super::{AliasResolver, FileData, GraphData, ParsedEdge, ParsedNode};
use super::nextjs::resolve_nextjs_edges;
use super::cmake::CMakeData;
use super::utils::resolve_import_path;

/// Resolve all import edges, match API calls to endpoints,
/// flatten barrel files, and construct the final GraphData.
pub fn build_graph(
    files_data: &[FileData],
    nodes: Vec<ParsedNode>,
    workspace_root: &Path,
    package_name: Option<&str>,
    node_index: &std::collections::HashMap<String, usize>,
    alias_resolver: &AliasResolver,
    cmake_data: &CMakeData,
    ext_deps: &HashSet<String>,
) -> GraphData {
    let mut edges: Vec<ParsedEdge> = Vec::new();

    // ── Static import edges ──────────────────────────────────────────────────
    for file_data in files_data {
        for import_str in &file_data.imports {
            let mut target_id = None;

            if let Some(idx) = resolve_import_path(
                &file_data.path,
                workspace_root,
                &import_str.0,
                package_name,
                node_index,
                &nodes,
                alias_resolver,
            ) {
                target_id = Some(nodes[idx].id.clone());
            } else if import_str.0.ends_with(".h") || import_str.0.ends_with(".hpp") {
                // C/C++ header fallback via cmake include dirs
                let file_name = Path::new(&import_str.0)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let mut search_dir = file_data.path.parent();
                let mut resolved_header_id: Option<String> = None;
                let mut header_index = std::collections::HashMap::new();
                for n in &nodes {
                    if n.group == "h" || n.group == "hpp" || n.group == "hxx" {
                        let fname = Path::new(&n.id)
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        header_index.insert(fname, n.id.clone());
                    }
                }

                while let Some(dir) = search_dir {
                    if let Some(inc_dirs) = cmake_data.include_dirs.get(dir) {
                        for inc in inc_dirs {
                            let possible_path = dir.join(inc).join(&import_str.0);
                            let possible_id = possible_path.to_string_lossy().replace('\\', "/");
                            if node_index.contains_key(&possible_id.to_lowercase()) {
                                resolved_header_id = Some(possible_id);
                                break;
                            }
                        }
                    }
                    if resolved_header_id.is_some() || dir == workspace_root {
                        break;
                    }
                    search_dir = dir.parent();
                }

                if resolved_header_id.is_none() {
                    if let Some(header_id) = header_index.get(&file_name) {
                        resolved_header_id = Some(header_id.clone());
                    }
                }
                if let Some(header_id) = resolved_header_id {
                    target_id = Some(header_id);
                }
            }

            if target_id.is_none() {
                let scoped_pkg = if import_str.0.starts_with('@') {
                    import_str.0.split('/').take(2).collect::<Vec<_>>().join("/")
                } else {
                    import_str.0.split('/').next().unwrap_or(&import_str.0).to_string()
                };
                if ext_deps.contains(&scoped_pkg) {
                    target_id = Some(format!("ext:{}", scoped_pkg));
                }
            }

            if let Some(target) = target_id {
                let mut source_node = file_data.id.clone();
                let mut target_node = target.clone();

                let is_c_cpp = source_node.ends_with(".c")
                    || source_node.ends_with(".cpp")
                    || source_node.ends_with(".cc")
                    || source_node.ends_with(".cxx");
                let is_main = source_node.ends_with("main.c")
                    || source_node.ends_with("main.cpp")
                    || source_node.ends_with("app_main.c");

                if is_c_cpp && !is_main {
                    std::mem::swap(&mut source_node, &mut target_node);
                }

                let mut via = None;
                for (source_path, imported_name) in &file_data.import_specifiers {
                    if source_path == &import_str.0 {
                        for (route, handler) in &file_data.express_routes {
                            if handler == imported_name {
                                via = Some(route.clone());
                                break;
                            }
                        }
                    }
                    if via.is_some() { break; }
                }

                edges.push(ParsedEdge {
                    source: source_node,
                    target: target_node,
                    via,
                    is_data_source: import_str.1,
                });
            }
        }
    }

    // ── API call → endpoint edges ────────────────────────────────────────────
    let url_base_re = Regex::new(r"^https?://[^/]+").unwrap();
    let param_re = Regex::new(r"\{[^}]+\}|<[^>]+>|:[^/]+").unwrap();

    for frontend_file in files_data {
        for api_call in &frontend_file.api_calls {
            let clean_api = url_base_re.replace(api_call, "");
            let clean_api = clean_api.split('?').next().unwrap_or(&clean_api);

            for backend_file in files_data {
                for endpoint in &backend_file.api_endpoints {
                    let endpoint_pattern = param_re.replace_all(endpoint, "[^/]+");
                    let endpoint_regex_str = format!("(?i){}$", endpoint_pattern.replace('?', "\\?"));
                    let matched = if let Ok(re) = Regex::new(&endpoint_regex_str) {
                        re.is_match(clean_api)
                    } else {
                        clean_api.contains(endpoint) || endpoint.contains(clean_api)
                    };
                    if matched {
                        edges.push(ParsedEdge {
                            source: frontend_file.id.clone(),
                            target: backend_file.id.clone(),
                            via: Some("API Call".to_string()),
                            is_data_source: true,
                        });
                    }
                }
            }
        }
    }

    // ── CMake component edges ─────────────────────────────────────────────────
    for (cmake_dir, deps) in &cmake_data.component_deps {
        let cmake_dir_str = cmake_dir.to_string_lossy().replace('\\', "/");
        if let Some(main_node) = nodes.iter().find(|n| n.id.starts_with(&cmake_dir_str)) {
            let main_id = main_node.id.clone();
            for dep in deps {
                if let Some(dep_node) = nodes.iter().find(|n| n.id.contains(dep)) {
                    edges.push(ParsedEdge {
                        source: main_id.clone(),
                        target: dep_node.id.clone(),
                        via: Some(format!("CMake Requires {}", dep)),
                        is_data_source: false,
                    });
                }
            }
        }
    }

    // ── Next.js implicit edges ────────────────────────────────────────────────
    resolve_nextjs_edges(&nodes, &mut edges);

    // ── Barrel / router flattening ───────────────────────────────────────────
    let barrel_ids: Vec<String> = files_data.iter().filter(|f| f.is_barrel_file).map(|f| f.id.clone()).collect();
    let router_ids: Vec<String> = files_data
        .iter()
        .filter(|f| f.is_router || f.id.contains("/api/") || f.id.contains("route.ts") || f.id.contains("route.js"))
        .map(|f| f.id.clone())
        .collect();

    let mut ids_to_bypass = barrel_ids.clone();
    ids_to_bypass.extend(router_ids.clone());

    let mut final_edges = edges;
    for bypass_id in &ids_to_bypass {
        let incoming: Vec<ParsedEdge> = final_edges.iter().filter(|e| &e.target == bypass_id).cloned().collect();
        let outgoing: Vec<ParsedEdge> = final_edges.iter().filter(|e| &e.source == bypass_id).cloned().collect();
        for inc in &incoming {
            for out in &outgoing {
                if inc.source != out.target {
                    let proxy_filename = Path::new(bypass_id).file_name().unwrap_or_default().to_string_lossy().to_string();
                    let new_via = match &inc.via {
                        None => Some(proxy_filename),
                        Some(v) => Some(format!("{}, {}", v, proxy_filename)),
                    };
                    final_edges.push(ParsedEdge {
                        source: inc.source.clone(),
                        target: out.target.clone(),
                        via: new_via,
                        is_data_source: inc.is_data_source || out.is_data_source,
                    });
                }
            }
        }
        final_edges.retain(|e| &e.source != bypass_id && &e.target != bypass_id);
    }

    // ── Unused export detection ───────────────────────────────────────────────
    let final_nodes = crate::parser::unused_exports::annotate_unused_exports(
        nodes,
        files_data,
        workspace_root,
        package_name,
        node_index,
        alias_resolver,
        &ids_to_bypass,
    );

    GraphData { nodes: final_nodes, edges: final_edges }
}
