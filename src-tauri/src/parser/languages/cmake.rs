use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use ignore::WalkBuilder;
use crate::parser::utils::utils::is_ignored;

pub struct CMakeData {
    pub component_deps: HashMap<PathBuf, Vec<String>>,
    pub include_dirs: HashMap<PathBuf, Vec<String>>,
}

pub fn parse_cmake_projects(workspace_root: &Path) -> CMakeData {
    let mut component_deps = HashMap::new();
    let mut include_dirs = HashMap::new();

    let idf_req_re = Regex::new(r#"(?is)idf_component_register\s*\((.*?)\)"#).unwrap();
    let target_inc_re = Regex::new(r#"(?is)target_include_directories\s*\(\s*[^ ]+\s+(?:PUBLIC|PRIVATE|INTERFACE)\s+([^)]+)\)"#).unwrap();

    for result in WalkBuilder::new(workspace_root)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(|e| !is_ignored(e, false))
        .build()
    {
        if let Ok(entry) = result {
            if entry.path().is_file() && entry.path().file_name().unwrap_or_default() == "CMakeLists.txt" {
                let parent_dir = entry.path().parent().unwrap().to_path_buf();
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    for cap in idf_req_re.captures_iter(&content) {
                        if let Some(block) = cap.get(1) {
                            let block_str = block.as_str();
                            
                            let mut deps = Vec::new();
                            let mut incs = Vec::new();
                            
                            enum ParseState {
                                None,
                                Requires,
                                IncludeDirs,
                            }
                            let mut state = ParseState::None;
                            
                            for word in block_str.split_whitespace() {
                                match word {
                                    "SRCS" | "LDFRAGMENTS" => state = ParseState::None,
                                    "REQUIRES" | "PRIV_REQUIRES" => state = ParseState::Requires,
                                    "INCLUDE_DIRS" => state = ParseState::IncludeDirs,
                                    _ => {
                                        let clean_word = word.trim_matches(|c| c == '"' || c == '\'');
                                        if !clean_word.is_empty() {
                                            match state {
                                                ParseState::Requires => deps.push(clean_word.to_string()),
                                                ParseState::IncludeDirs => incs.push(clean_word.to_string()),
                                                ParseState::None => {}
                                            }
                                        }
                                    }
                                }
                            }

                            if !deps.is_empty() {
                                component_deps.insert(parent_dir.clone(), deps);
                            }
                            if !incs.is_empty() {
                                include_dirs.insert(parent_dir.clone(), incs);
                            }
                        }
                    }

                    for cap in target_inc_re.captures_iter(&content) {
                        if let Some(inc_match) = cap.get(1) {
                            let mut incs = include_dirs.remove(&parent_dir).unwrap_or_default();
                            for inc in inc_match.as_str().split_whitespace() {
                                let clean_inc = inc.trim_matches(|c| c == '"' || c == '\'');
                                if !clean_inc.is_empty() {
                                    incs.push(clean_inc.to_string());
                                }
                            }
                            if !incs.is_empty() {
                                include_dirs.insert(parent_dir.clone(), incs);
                            }
                        }
                    }
                }
            }
        }
    }

    CMakeData { component_deps, include_dirs }
}
