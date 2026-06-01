use oxc_allocator::Allocator;
use oxc_ast::ast::{ImportDeclarationSpecifier, ModuleDeclaration};
use oxc_parser::Parser;
use oxc_span::SourceType;
use regex::Regex;
use std::path::Path;

pub fn extract_javascript_imports(
    source_text: &str,
    file_path: &Path,
    imports: &mut Vec<(String, bool)>,
    api_calls: &mut Vec<String>,
    exported_symbols: &mut Vec<String>,
    import_specifiers: &mut Vec<(String, String)>,
) -> (bool, bool, Vec<String>, Vec<(String, String)>) {
    let mut is_barrel_file = false;
    let mut has_exports = false;
    let mut all_exports_imports = true;

    let api_re = Regex::new(r#"(?:invoke|fetch|axios|request|client|api|trpc(?:\.(?:get|post|put|delete|patch|request|useQuery|useMutation))?)\s*\(\s*[`"']([^`"'\?]+)[`"'\?]"#).unwrap();
    for cap in api_re.captures_iter(source_text) {
        if let Some(url) = cap.get(1) {
            api_calls.push(url.as_str().to_string());
        }
    }

    // Extract dynamic imports and CommonJS requires
    let dyn_import_re = Regex::new(r#"(?:require|import)\s*\(\s*[`"']([^`"'\?]+)[`"'\?]"#).unwrap();
    for cap in dyn_import_re.captures_iter(source_text) {
        if let Some(url) = cap.get(1) {
            let src = url.as_str().to_string();
            imports.push((src, false));
        }
    }

    let mut tags = Vec::new();
    let mut express_routes = Vec::new();

    // Decorator extraction for Angular and NestJS
    let decorator_re = Regex::new(r"(?m)^\s*@(NgModule|Component|Injectable|Controller|Module|Directive)\b").unwrap();
    for cap in decorator_re.captures_iter(source_text) {
        if let Some(dec) = cap.get(1) {
            match dec.as_str() {
                "NgModule" => tags.push("angular-module".to_string()),
                "Component" => tags.push("angular-component".to_string()),
                "Directive" => tags.push("angular-directive".to_string()),
                "Controller" => tags.push("nest-controller".to_string()),
                "Module" => tags.push("nest-module".to_string()),
                "Injectable" => tags.push("injectable".to_string()),
                _ => {}
            }
        }
    }

    tags.sort();
    tags.dedup();

    let express_re = Regex::new(r#"(?m)(?:app|router)\.(get|post|put|delete|patch|all|use)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([a-zA-Z0-9_]+)"#).unwrap();
    for cap in express_re.captures_iter(source_text) {
        if let (Some(method), Some(route), Some(handler)) = (cap.get(1), cap.get(2), cap.get(3)) {
            let method_str = method.as_str().to_uppercase();
            let route_str = route.as_str().to_string();
            let handler_str = handler.as_str().to_string();
            let display_route = if method_str == "USE" {
                format!("USE {}", route_str)
            } else {
                format!("{} {}", method_str, route_str)
            };
            express_routes.push((display_route, handler_str));
        }
    }

    let allocator = Allocator::default();
    let source_type = SourceType::from_path(file_path).unwrap_or_default();
    let ret = Parser::new(&allocator, source_text, source_type).parse();

    if ret.errors.is_empty() {
        let program = ret.program;

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
                                        import_specifiers.push((source.clone(), s.imported.name().to_string()));
                                    }
                                    ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                                        local_names.push(s.local.name.to_string());
                                        import_specifiers.push((source.clone(), "default".to_string()));
                                    }
                                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                                        local_names.push(s.local.name.to_string());
                                        import_specifiers.push((source.clone(), "*".to_string()));
                                    }
                                }
                            }
                        }

                        let mut is_data_source = false;
                        for name in local_names {
                            let jsx_pattern = format!("<{}", name);
                            let call_pattern = format!("{}(", name);
                            let call_pattern_space = format!("{} (", name);

                            if (source_text.contains(&call_pattern)
                                || source_text.contains(&call_pattern_space))
                                && !source_text.contains(&jsx_pattern)
                            {
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

        if all_exports_imports && has_exports {
            is_barrel_file = true;
        }
    }

    // Use regex to catch all exports reliably without exhaustive AST matching
    let export_re = Regex::new(r"(?m)^export\s+(?:const|let|var|function|class|default\s+(?:function|class)?)\s*([a-zA-Z0-9_$]*)").unwrap();
    for cap in export_re.captures_iter(source_text) {
        if let Some(name) = cap.get(1) {
            let n = name.as_str().to_string();
            if !n.is_empty() {
                exported_symbols.push(n);
            } else if cap.get(0).unwrap().as_str().contains("default") {
                exported_symbols.push("default".to_string());
            }
        }
    }

    let export_list_re = Regex::new(r"(?m)^export\s*\{([^}]+)\}").unwrap();
    for cap in export_list_re.captures_iter(source_text) {
        if let Some(list) = cap.get(1) {
            for item in list.as_str().split(',') {
                let item = item.trim();
                if !item.is_empty() {
                    let parts: Vec<&str> = item.split_whitespace().collect();
                    if parts.len() == 3 && parts[1] == "as" {
                        exported_symbols.push(parts[2].to_string());
                    } else if let Some(first) = parts.first() {
                        exported_symbols.push(first.to_string());
                    }
                }
            }
        }
    }

    (is_barrel_file, has_exports, tags, express_routes)
}
