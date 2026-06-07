use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use ignore::WalkBuilder;
use crate::parser::utils::utils::is_ignored;
use tree_sitter::Parser as TSParser;

pub struct CMakeData {
    pub component_deps: HashMap<PathBuf, Vec<(String, bool)>>, // (dep_name, is_private)
    pub include_dirs: HashMap<PathBuf, Vec<String>>,
}

thread_local! {
    pub static CMAKE_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter_cmake::LANGUAGE.into()).unwrap();
        std::cell::RefCell::new(p)
    };
}

pub fn parse_cmake_projects(workspace_root: &Path) -> CMakeData {
    let mut component_deps = HashMap::new();
    let mut include_dirs = HashMap::new();

    for result in WalkBuilder::new(workspace_root)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(|e| !is_ignored(e, false))
        .build()
    {
        if let Ok(entry) = result {
            if entry.path().is_file() && (entry.path().file_name().unwrap_or_default() == "CMakeLists.txt" || entry.path().extension().and_then(|s| s.to_str()) == Some("cmake")) {
                let parent_dir = entry.path().parent().unwrap().to_path_buf();
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let mut deps = Vec::new();
                    let mut incs = Vec::new();

                    CMAKE_PARSER.with(|parser| {
                        let mut parser = parser.borrow_mut();
                        if let Some(tree) = parser.parse(&content, None) {
                            let mut cursor = tree.walk();
                            let mut reached_root = false;
                            while !reached_root {
                                let node = cursor.node();
                                if node.kind() == "normal_command" {
                                    if let Some(cmd_node) = node.child(0) {
                                        if let Ok(cmd_name) = cmd_node.utf8_text(content.as_bytes()) {
                                            let cmd_name = cmd_name.to_lowercase();
                                            if cmd_name == "idf_component_register" || cmd_name == "target_link_libraries" || cmd_name == "target_include_directories" || cmd_name == "add_subdirectory" {
                                                // Extract arguments
                                                if let Some(arg_list) = node.child(1) {
                                                    let mut args = Vec::new();
                                                    let mut arg_cursor = arg_list.walk();
                                                    if arg_cursor.goto_first_child() {
                                                        loop {
                                                            let arg_node = arg_cursor.node();
                                                            if arg_node.kind() == "argument" {
                                                                if let Ok(arg_text) = arg_node.utf8_text(content.as_bytes()) {
                                                                    args.push(arg_text.trim_matches('"').to_string());
                                                                }
                                                            }
                                                            if !arg_cursor.goto_next_sibling() { break; }
                                                        }
                                                    }

                                                    if cmd_name == "idf_component_register" {
                                                        let mut state = "none";
                                                        for arg in &args {
                                                            match arg.as_str() {
                                                                "REQUIRES" => state = "requires",
                                                                "PRIV_REQUIRES" => state = "priv_requires",
                                                                "INCLUDE_DIRS" | "PRIV_INCLUDE_DIRS" => state = "includes",
                                                                "SRCS" | "LDFRAGMENTS" => state = "none",
                                                                _ => {
                                                                    if state == "requires" {
                                                                        deps.push((arg.clone(), false));
                                                                    } else if state == "priv_requires" {
                                                                        deps.push((arg.clone(), true));
                                                                    } else if state == "includes" {
                                                                        incs.push(arg.clone());
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    } else if cmd_name == "target_link_libraries" {
                                                        let mut state = "public";
                                                        let mut skip_first = true;
                                                        for arg in &args {
                                                            if skip_first { skip_first = false; continue; }
                                                            match arg.as_str() {
                                                                "PUBLIC" | "INTERFACE" => state = "public",
                                                                "PRIVATE" => state = "private",
                                                                _ => {
                                                                    deps.push((arg.clone(), state == "private"));
                                                                }
                                                            }
                                                        }
                                                    } else if cmd_name == "target_include_directories" {
                                                        let mut skip_first = true;
                                                        for arg in &args {
                                                            if skip_first { skip_first = false; continue; }
                                                            match arg.as_str() {
                                                                "PUBLIC" | "INTERFACE" | "PRIVATE" => {},
                                                                _ => {
                                                                    incs.push(arg.clone());
                                                                }
                                                            }
                                                        }
                                                    } else if cmd_name == "add_subdirectory" {
                                                        if let Some(arg) = args.first() {
                                                            deps.push((arg.clone(), false)); // Treat add_subdirectory as a dependency on that directory
                                                        }
                                                    }
                                                }
                                            }
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
                    });

                    if !deps.is_empty() {
                        let mut current_deps: Vec<(String, bool)> = component_deps.remove(&parent_dir).unwrap_or_default();
                        current_deps.extend(deps);
                        component_deps.insert(parent_dir.clone(), current_deps);
                    }
                    if !incs.is_empty() {
                        let mut current_incs: Vec<String> = include_dirs.remove(&parent_dir).unwrap_or_default();
                        current_incs.extend(incs);
                        include_dirs.insert(parent_dir.clone(), current_incs);
                    }
                }
            }
        }
    }

    CMakeData { component_deps, include_dirs }
}
