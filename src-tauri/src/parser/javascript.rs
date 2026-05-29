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
) -> (bool, bool) {
    let mut is_barrel_file = false;
    let mut has_exports = false;
    let mut all_exports_imports = true;

    // Extract API calls using a comprehensive regex for custom clients
    let api_re = Regex::new(r#"(?:fetch|axios|request|client|api|trpc(?:\.(?:get|post|put|delete|patch|request|useQuery|useMutation))?)\s*\(\s*[`"']([^`"'\?]+)[`"'\?]"#).unwrap();
    for cap in api_re.captures_iter(source_text) {
        if let Some(url) = cap.get(1) {
            api_calls.push(url.as_str().to_string());
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

    (is_barrel_file, has_exports)
}
