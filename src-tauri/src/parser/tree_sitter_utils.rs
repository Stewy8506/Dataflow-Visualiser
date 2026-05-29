use regex::Regex;
use tree_sitter::Parser as TSParser;

pub fn extract_imports_with_parser(
    parser: &mut TSParser,
    source_text: &str,
    ext: &str,
    imports: &mut Vec<(String, bool)>,
    api_endpoints: &mut Vec<String>,
) {
    if ext == "py" {
        let endpoint_re = Regex::new(r#"@(?:app|router|bp)\.(?:get|post|put|delete|patch|route)\(\s*["']([^"'\?]+)["']"#).unwrap();
        for cap in endpoint_re.captures_iter(source_text) {
            if let Some(route) = cap.get(1) {
                api_endpoints.push(route.as_str().to_string());
            }
        }
    } else if ext == "rs" {
        let tauri_cmd_re = Regex::new(r#"#\[tauri::command\]\s*(?:async\s+)?fn\s+([a-zA-Z0-9_]+)"#).unwrap();
        for cap in tauri_cmd_re.captures_iter(source_text) {
            if let Some(cmd) = cap.get(1) {
                api_endpoints.push(cmd.as_str().to_string());
            }
        }
    }

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
            } else if ext == "rs" && kind == "mod_item" {
                if let Ok(text) = node.utf8_text(source_text.as_bytes()) {
                    let clean = text.replace("pub mod ", "").replace("mod ", "").replace(';', "").trim().to_string();
                    imports.push((format!("./{}", clean), false));
                }
                if cursor.goto_first_child() {
                    continue;
                }
            } else if ext == "dart" && kind == "import_or_export" {
                target_node = Some(node);
            } else if matches!(ext, "c" | "h" | "cpp" | "hpp" | "cc" | "cxx" | "hxx")
                && kind == "preproc_include"
            {
                target_node = Some(node);
            }

            if let Some(n) = target_node {
                if let Ok(text) = n.utf8_text(source_text.as_bytes()) {
                    let clean = text
                        .replace("import ", "")
                        .replace("from ", "")
                        .replace("use ", "")
                        .replace("#include ", "")
                        .replace("<", "")
                        .replace(">", "")
                        .replace(';', "")
                        .replace('\'', "")
                        .replace('"', "");
                    let parts: Vec<&str> = clean.split_whitespace().collect();
                    if parts.len() >= 2 {
                        imports.push((format!("{}/{}", parts[0], parts[1]), false));
                        imports.push((parts[0].to_string(), false));
                    } else if let Some(module) = parts.first() {
                        imports.push((module.to_string(), false));
                    }
                }
            }

            if cursor.goto_first_child() {
                continue;
            }
            if cursor.goto_next_sibling() {
                continue;
            }
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
