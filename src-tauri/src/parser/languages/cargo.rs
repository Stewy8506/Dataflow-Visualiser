use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use regex::Regex;
use std::fs;

pub struct CargoWorkspaceData {
    // Maps crate path (absolute) to its local dependencies (absolute paths)
    pub member_deps: HashMap<PathBuf, Vec<PathBuf>>,
}

pub fn parse_cargo_workspaces(workspace_root: &Path) -> CargoWorkspaceData {
    let mut member_deps = HashMap::new();
    let mut to_visit = vec![workspace_root.to_path_buf()];
    let mut visited = HashSet::new();

    let path_re = Regex::new(r#"path\s*=\s*['"]([^'"]+)['"]"#).unwrap();
    let members_re = Regex::new(r#"(?s)\[workspace\][^\[]*members\s*=\s*\[(.*?)\]"#).unwrap();
    let string_re = Regex::new(r#"['"]([^'"]+)['"]"#).unwrap();

    while let Some(dir) = to_visit.pop() {
        if !visited.insert(dir.clone()) {
            continue;
        }

        let cargo_toml = dir.join("Cargo.toml");
        if let Ok(content) = fs::read_to_string(&cargo_toml) {
            let mut local_deps = Vec::new();
            
            // Extract local path dependencies
            for cap in path_re.captures_iter(&content) {
                if let Some(path_match) = cap.get(1) {
                    let rel_path = path_match.as_str();
                    let abs_path = dir.join(rel_path).canonicalize().unwrap_or_else(|_| dir.join(rel_path));
                    local_deps.push(abs_path);
                }
            }
            if !local_deps.is_empty() {
                member_deps.insert(dir.clone(), local_deps);
            }

            // If this is a workspace root, add members
            if let Some(workspace_match) = members_re.captures(&content) {
                if let Some(members_str) = workspace_match.get(1) {
                    for cap in string_re.captures_iter(members_str.as_str()) {
                        let member_path = cap.get(1).unwrap().as_str();
                        if member_path.contains('*') {
                            // Basic glob support (e.g., "crates/*")
                            let prefix = member_path.trim_end_matches('*').trim_end_matches('/');
                            let glob_dir = dir.join(prefix);
                            if let Ok(entries) = fs::read_dir(glob_dir) {
                                for entry in entries.flatten() {
                                    if entry.path().is_dir() {
                                        to_visit.push(entry.path());
                                    }
                                }
                            }
                        } else {
                            to_visit.push(dir.join(member_path));
                        }
                    }
                }
            }
        }
    }

    CargoWorkspaceData { member_deps }
}
