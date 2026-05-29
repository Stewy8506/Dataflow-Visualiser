use regex::Regex;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct PropTrace {
    pub prop_name: String,
    pub origin_file: String,
    pub chain: Vec<PropChainLink>,
    pub involved_files: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct PropChainLink {
    pub file: String,
    pub component: String,
    pub line: usize,
    pub action: String, // "passes_through" | "consumes"
}

#[tauri::command]
pub async fn trace_prop(
    workspace_path: String,
    file_path: String,
    prop_name: String,
) -> Result<PropTrace, String> {
    let mut chain = Vec::new();
    let mut visited = std::collections::HashSet::new();

    trace_recursive(
        &workspace_path,
        &file_path,
        &prop_name,
        &mut chain,
        &mut visited,
        0,
    );

    Ok(PropTrace {
        prop_name,
        origin_file: file_path,
        chain,
        involved_files: visited.into_iter().collect(),
    })
}

fn trace_recursive(
    workspace_path: &str,
    current_file: &str,
    prop_name: &str,
    chain: &mut Vec<PropChainLink>,
    visited: &mut std::collections::HashSet<String>,
    depth: usize,
) {
    if depth > 10 || visited.contains(current_file) {
        return;
    }
    visited.insert(current_file.to_string());

    let content = match fs::read_to_string(current_file) {
        Ok(c) => c,
        Err(_) => return,
    };

    // Very basic regex to find `<Component ... prop={...}` or `<Component ... prop=`
    // This is a heuristic and might have false positives.
    let re_tag = Regex::new(&format!(
        r"<([A-Z][a-zA-Z0-9_]*)[^>]*\b{}\b\s*=",
        regex::escape(prop_name)
    ))
    .unwrap();

    // Also we need to know where components are imported from
    let re_import =
        Regex::new(r#"(?m)^import\s+.*?([A-Z][a-zA-Z0-9_]*).*?\s+from\s+['"]([^'"]+)['"]"#)
            .unwrap();

    let mut component_imports = std::collections::HashMap::new();
    for cap in re_import.captures_iter(&content) {
        let comp_name = cap[1].to_string();
        let import_path = cap[2].to_string();
        component_imports.insert(comp_name, import_path);
    }

    let mut next_files = Vec::new();

    for (i, line) in content.lines().enumerate() {
        for cap in re_tag.captures_iter(line) {
            let comp_name = &cap[1];

            chain.push(PropChainLink {
                file: current_file.to_string(),
                component: comp_name.to_string(),
                line: i + 1,
                action: "passes_through".to_string(),
            });

            // If we know where this component comes from, trace into it
            if let Some(import_src) = component_imports.get(comp_name) {
                // Try to resolve it
                let current_dir = Path::new(current_file).parent().unwrap_or(Path::new(""));
                let resolved =
                    resolve_import_heuristically(current_dir, import_src, workspace_path);
                if let Some(res) = resolved {
                    next_files.push(res);
                }
            }
        }
    }

    for next_file in next_files {
        trace_recursive(
            workspace_path,
            &next_file,
            prop_name,
            chain,
            visited,
            depth + 1,
        );
    }
}

fn resolve_import_heuristically(
    current_dir: &Path,
    import_src: &str,
    workspace: &str,
) -> Option<String> {
    if import_src.starts_with('.') {
        let joined = current_dir.join(import_src);

        let exts = ["tsx", "jsx", "ts", "js"];

        for ext in exts {
            let file_path = joined.with_extension(ext);
            if file_path.exists() {
                return Some(file_path.to_string_lossy().replace('\\', "/"));
            }

            // Try index file
            let index_path = joined.join(format!("index.{}", ext));
            if index_path.exists() {
                return Some(index_path.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    // Very basic alias fallback
    if import_src.starts_with("@/") || import_src.starts_with("~/") {
        let clean = import_src.replace("@/", "").replace("~/", "");
        let joined = Path::new(workspace).join("src").join(&clean);
        let exts = ["tsx", "jsx", "ts", "js"];
        for ext in exts {
            let file_path = joined.with_extension(ext);
            if file_path.exists() {
                return Some(file_path.to_string_lossy().replace('\\', "/"));
            }
            let index_path = joined.join(format!("index.{}", ext));
            if index_path.exists() {
                return Some(index_path.to_string_lossy().replace('\\', "/"));
            }
        }
    }

    None
}
