use regex::Regex;
use tree_sitter::{Parser as TSParser, StreamingIterator};

pub fn extract_imports_with_parser(
    parser: &mut TSParser,
    source_text: &str,
    ext: &str,
    imports: &mut Vec<(String, bool)>,
    custom_edges: &mut Vec<(String, String)>,
    api_endpoints: &mut Vec<String>,
) {
    if ext == "py" {
        let endpoint_re = Regex::new(
            r#"@(?:app|router|bp)\.(?:get|post|put|delete|patch|route)\(\s*["']([^"'\?]+)["']"#,
        )
        .unwrap();
        for cap in endpoint_re.captures_iter(source_text) {
            if let Some(route) = cap.get(1) {
                api_endpoints.push(route.as_str().to_string());
            }
        }

        if let Some(tree) = parser.parse(source_text, None) {
            if let Some(lang) = parser.language() {
                // Django ORM relationships
                if let Ok(django_query) = tree_sitter::Query::new(
                    &lang,
                    r#"
                    (call
                        function: (attribute
                            object: (identifier) @obj
                            attribute: (identifier) @attr
                            (#match? @obj "^models$")
                            (#match? @attr "^(ForeignKey|OneToOneField|ManyToManyField)$")
                        )
                        arguments: (argument_list
                            (identifier) @target_model
                        )
                    )
                    (call
                        function: (identifier) @attr
                        (#match? @attr "^(ForeignKey|OneToOneField|ManyToManyField)$")
                        arguments: (argument_list
                            (identifier) @target_model
                        )
                    )
                    "#,
                ) {
                    let mut qc = tree_sitter::QueryCursor::new();
                    let mut matches =
                        qc.matches(&django_query, tree.root_node(), source_text.as_bytes());
                    while let Some(m) = matches.next() {
                        for cap in m.captures {
                            if django_query.capture_names()[cap.index as usize] == "target_model" {
                                if let Ok(model_name) = cap.node.utf8_text(source_text.as_bytes()) {
                                    custom_edges.push((
                                        model_name.to_string(),
                                        "DatabaseRelation".to_string(),
                                    ));
                                }
                            }
                        }
                    }
                }

                // Celery task execution
                if let Ok(celery_query) = tree_sitter::Query::new(
                    &lang,
                    r#"
                    (call
                        function: (attribute
                            object: (identifier) @task_name
                            attribute: (identifier) @method
                            (#match? @method "^(delay|apply_async)$")
                        )
                    )
                    "#,
                ) {
                    let mut qc = tree_sitter::QueryCursor::new();
                    let mut matches =
                        qc.matches(&celery_query, tree.root_node(), source_text.as_bytes());
                    while let Some(m) = matches.next() {
                        for cap in m.captures {
                            if celery_query.capture_names()[cap.index as usize] == "task_name" {
                                if let Ok(task_name) = cap.node.utf8_text(source_text.as_bytes()) {
                                    custom_edges.push((
                                        task_name.to_string(),
                                        "AsyncExecution".to_string(),
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if ext == "rs" {
        let tauri_cmd_re =
            Regex::new(r#"#\[tauri::command\]\s*(?:async\s+)?fn\s+([a-zA-Z0-9_]+)"#).unwrap();
        for cap in tauri_cmd_re.captures_iter(source_text) {
            if let Some(cmd) = cap.get(1) {
                api_endpoints.push(cmd.as_str().to_string());
            }
        }
    } else if ext == "dart" {
        if let Some(tree) = parser.parse(source_text, None) {
            if let Some(lang) = parser.language() {
                if let Ok(widget_query) = tree_sitter::Query::new(
                    &lang,
                    r#"
                    (creation_expression
                        type: (type_identifier) @widget_name
                    )
                    (invocation
                        function: (identifier) @widget_name
                        (#match? @widget_name "^[A-Z]")
                    )
                    "#,
                ) {
                    let mut qc = tree_sitter::QueryCursor::new();
                    let mut matches =
                        qc.matches(&widget_query, tree.root_node(), source_text.as_bytes());
                    while let Some(m) = matches.next() {
                        for cap in m.captures {
                            if widget_query.capture_names()[cap.index as usize] == "widget_name" {
                                if let Ok(widget_name) = cap.node.utf8_text(source_text.as_bytes())
                                {
                                    custom_edges
                                        .push((widget_name.to_string(), "WidgetTree".to_string()));
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if ext == "java" {
        if let Some(tree) = parser.parse(source_text, None) {
            if let Some(lang) = parser.language() {
                if let Ok(injection_query) = tree_sitter::Query::new(
                    &lang,
                    r#"
                    (field_declaration
                        (modifiers
                            (marker_annotation
                                name: (identifier) @annotation
                                (#match? @annotation "^(Autowired|Inject)$")
                            )
                        )
                        type: (type_identifier) @injected_type
                    )
                    (method_declaration
                        (modifiers
                            (marker_annotation
                                name: (identifier) @annotation
                                (#match? @annotation "^Bean$")
                            )
                        )
                        type: (type_identifier) @bean_type
                    )
                    "#,
                ) {
                    let mut qc = tree_sitter::QueryCursor::new();
                    let mut matches =
                        qc.matches(&injection_query, tree.root_node(), source_text.as_bytes());
                    while let Some(m) = matches.next() {
                        for cap in m.captures {
                            let name = &injection_query.capture_names()[cap.index as usize];
                            if *name == "injected_type" || *name == "bean_type" {
                                if let Ok(type_name) = cap.node.utf8_text(source_text.as_bytes()) {
                                    custom_edges
                                        .push((type_name.to_string(), "Injection".to_string()));
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if ext == "cs" {
        if let Some(tree) = parser.parse(source_text, None) {
            if let Some(lang) = parser.language() {
                // DI Bindings: AddTransient<IInterface, Concrete>()
                if let Ok(di_query) = tree_sitter::Query::new(
                    &lang,
                    r#"
                    (invocation_expression
                        function: (member_access_expression
                            name: (generic_name
                                name: (identifier) @method
                                (#match? @method "^(AddTransient|AddScoped|AddSingleton)$")
                                type_arguments: (type_argument_list
                                    (identifier) @interface
                                    (identifier) @concrete
                                )
                            )
                        )
                    )
                    "#,
                ) {
                    let mut qc = tree_sitter::QueryCursor::new();
                    let mut matches =
                        qc.matches(&di_query, tree.root_node(), source_text.as_bytes());
                    while let Some(m) = matches.next() {
                        let mut interface_name = None;
                        let mut concrete_name = None;
                        for cap in m.captures {
                            let name = &di_query.capture_names()[cap.index as usize];
                            if *name == "interface" {
                                interface_name = cap.node.utf8_text(source_text.as_bytes()).ok();
                            } else if *name == "concrete" {
                                concrete_name = cap.node.utf8_text(source_text.as_bytes()).ok();
                            }
                        }
                        if let (Some(i), Some(c)) = (interface_name, concrete_name) {
                            custom_edges.push((format!("{}|{}", i, c), "DiBinding".to_string()));
                        }
                    }
                }

                // Constructor Injections
                if let Ok(ctor_query) = tree_sitter::Query::new(
                    &lang,
                    r#"
                    (constructor_declaration
                        parameters: (parameter_list
                            (parameter
                                type: (identifier) @injected_type
                            )
                        )
                    )
                    "#,
                ) {
                    let mut qc = tree_sitter::QueryCursor::new();
                    let mut matches =
                        qc.matches(&ctor_query, tree.root_node(), source_text.as_bytes());
                    while let Some(m) = matches.next() {
                        for cap in m.captures {
                            if ctor_query.capture_names()[cap.index as usize] == "injected_type" {
                                if let Ok(type_name) = cap.node.utf8_text(source_text.as_bytes()) {
                                    custom_edges
                                        .push((type_name.to_string(), "Injection".to_string()));
                                }
                            }
                        }
                    }
                }
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
                    let clean = text
                        .replace("pub mod ", "")
                        .replace("mod ", "")
                        .replace(';', "")
                        .trim()
                        .to_string();
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
            } else if ext == "java" && kind == "import_declaration" {
                target_node = Some(node);
            } else if ext == "cs" && kind == "using_directive" {
                target_node = Some(node);
            } else if ext == "go" && kind == "import_spec" {
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
