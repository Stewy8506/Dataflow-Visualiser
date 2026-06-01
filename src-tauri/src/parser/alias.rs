use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use regex::Regex;

pub struct AliasResolver {
    package_paths: HashMap<PathBuf, HashMap<String, Vec<String>>>,
    monorepo_packages: HashMap<String, String>,
    workspace_root: PathBuf,
}

impl AliasResolver {
    pub fn new(workspace_root: &Path) -> Self {
        let mut package_paths = HashMap::new();
        let mut monorepo_packages = HashMap::new();

        for result in ignore::WalkBuilder::new(workspace_root)
            .hidden(true)
            .git_ignore(true)
            .build()
        {
            if let Ok(entry) = result {
                if !entry.path().is_file() {
                    continue;
                }

                let file_name = entry.path().file_name().unwrap_or_default();
                let parent_dir = entry.path().parent().unwrap().to_path_buf();

                if file_name == "tsconfig.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let re_line = Regex::new(r"(?m)//.*$").unwrap();
                        let re_block = Regex::new(r"(?s)/\*.*?\*/").unwrap();
                        let no_block = re_block.replace_all(&content, "");
                        let no_line = re_line.replace_all(&no_block, "");

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&no_line) {
                            if let Some(compiler_options) = json.get("compilerOptions") {
                                if let Some(paths_val) = compiler_options.get("paths") {
                                    if let Ok(paths_map) =
                                        serde_json::from_value::<HashMap<String, Vec<String>>>(
                                            paths_val.clone(),
                                        )
                                    {
                                        package_paths
                                            .entry(parent_dir.clone())
                                            .or_insert_with(HashMap::new)
                                            .extend(paths_map);
                                    }
                                }
                            }
                        }
                    }
                } else if file_name == "vite.config.ts" || file_name == "vite.config.js" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let re = Regex::new(r#"["'](@/.*?)["']\s*:\s*["'](.*?)["']"#).unwrap();
                        let mut vite_paths = HashMap::new();
                        for cap in re.captures_iter(&content) {
                            if let (Some(alias), Some(target)) = (cap.get(1), cap.get(2)) {
                                vite_paths.insert(
                                    alias.as_str().to_string(),
                                    vec![target.as_str().to_string()],
                                );
                            }
                        }
                        if !vite_paths.is_empty() {
                            package_paths
                                .entry(parent_dir.clone())
                                .or_insert_with(HashMap::new)
                                .extend(vite_paths);
                        }
                    }
                } else if file_name == "package.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(name) = json.get("name").and_then(|n| n.as_str()) {
                                if let Ok(rel_path) = parent_dir.strip_prefix(workspace_root) {
                                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                                    monorepo_packages.insert(
                                        name.to_string(),
                                        if rel_str.is_empty() {
                                            ".".to_string()
                                        } else {
                                            rel_str
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        Self {
            package_paths,
            monorepo_packages,
            workspace_root: workspace_root.to_path_buf(),
        }
    }

    pub fn resolve(&self, import_str: &str, current_file_path: &Path) -> String {
        for (pkg_name, pkg_path) in &self.monorepo_packages {
            if import_str == pkg_name || import_str.starts_with(&format!("{}/", pkg_name)) {
                let rest = import_str.strip_prefix(pkg_name).unwrap_or("");
                let mut resolved = format!("{}{}", pkg_path, rest);
                if resolved.starts_with("./") {
                    resolved = resolved.strip_prefix("./").unwrap().to_string();
                }
                if resolved == "." {
                    resolved = pkg_path.to_string();
                }
                return resolved;
            }
        }

        // Find closest config by traversing up from current_file_path
        let mut search_dir = current_file_path.parent();
        while let Some(dir) = search_dir {
            if let Some(paths) = self.package_paths.get(dir) {
                for (alias, targets) in paths {
                    let alias_prefix = alias.trim_end_matches('*');
                    if import_str.starts_with(alias_prefix) {
                        if let Some(target) = targets.first() {
                            let target_prefix = target.trim_end_matches('*');
                            let rest = import_str.strip_prefix(alias_prefix).unwrap_or("");
                            let mut resolved = format!("{}{}", target_prefix, rest);
                            if resolved.starts_with("./") {
                                resolved = resolved.strip_prefix("./").unwrap().to_string();
                            }

                            // Make it relative to workspace_root so it resolves properly in the global graph
                            if let Ok(rel) = dir.strip_prefix(&self.workspace_root) {
                                let rel_str = rel.to_string_lossy().replace('\\', "/");
                                if !rel_str.is_empty() {
                                    resolved = format!("{}/{}", rel_str, resolved);
                                }
                            }

                            return resolved;
                        }
                    }
                }
            }
            if dir == self.workspace_root {
                break;
            }
            search_dir = dir.parent();
        }

        import_str.to_string()
    }
}
