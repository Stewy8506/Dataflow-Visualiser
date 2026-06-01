use super::{ParsedNode, AliasResolver};
use ignore::DirEntry;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub fn is_ignored(entry: &DirEntry, filter_mobile_platforms: bool) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| {
            let mut ignored = s.starts_with('.')
                || s == "node_modules"
                || s == "target"
                || s == "dist"
                || s == "build"
                || s.starts_with("next-env")
                || s == "next.config.ts"
                || s == "next.config.js";
                
            if filter_mobile_platforms {
                let lower = s.to_lowercase();
                ignored = ignored 
                    || lower == "windows"
                    || lower == "linux"
                    || lower == "ios"
                    || lower == "android"
                    || lower == "macos"
                    || lower == "web";
            }
            
            ignored
        })
        .unwrap_or(false)
}

pub fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        if component.as_os_str() == ".." {
            normalized.pop();
        } else if component.as_os_str() != "." {
            normalized.push(component);
        }
    }
    normalized
}

pub fn check_node_existence(path: &Path, node_index: &HashMap<String, usize>) -> Option<usize> {
    let key = path.to_string_lossy().replace('\\', "/").to_lowercase();
    node_index.get(&key).copied()
}

pub fn resolve_import_path(
    current_file_path: &Path,
    workspace_root: &Path,
    import_str: &str,
    package_name: Option<&str>,
    node_index: &HashMap<String, usize>,
    nodes: &[ParsedNode],
    alias_resolver: &AliasResolver,
) -> Option<usize> {
    let mut import_path = import_str.replace('\\', "/");

    if import_path.starts_with("package:") {
        if let Some(pkg) = package_name {
            let prefix = format!("package:{}/", pkg);
            if import_path.starts_with(&prefix) {
                let sub_path = import_path.strip_prefix(&prefix).unwrap();
                import_path = format!("lib/{}", sub_path);
            } else {
                return None;
            }
        } else {
            return None;
        }
    }

    if import_path.starts_with("crate::") {
        let sub_path = import_path
            .strip_prefix("crate::")
            .unwrap()
            .replace("::", "/");
        import_path = format!("src/{}", sub_path);
    }

    let mut clean_import = import_path
        .replace("super::", "../")
        .replace("self::", "./")
        .replace("::", "/");

    if clean_import.starts_with('.')
        && (clean_import.ends_with(".py")
            || current_file_path.extension().and_then(|s| s.to_str()) == Some("py"))
    {
        let dots_count = clean_import.chars().take_while(|c| *c == '.').count();
        let path_part = &clean_import[dots_count..];
        let relative_prefix =
            "../".repeat(dots_count - 1) + if dots_count == 1 { "./" } else { "" };
        clean_import = format!("{}{}", relative_prefix, path_part.replace('.', "/"));
    } else if current_file_path.extension().and_then(|s| s.to_str()) == Some("py") {
        clean_import = clean_import.replace('.', "/");
    }

    let resolved_alias = alias_resolver.resolve(&clean_import, current_file_path);
    let clean_import = resolved_alias
        .strip_prefix("@/")
        .or_else(|| resolved_alias.strip_prefix("~/"))
        .unwrap_or(&resolved_alias);

    let mut candidates = Vec::new();

    if clean_import.starts_with('.') {
        if let Some(dir) = current_file_path.parent() {
            let resolved = normalize_path(&dir.join(clean_import));
            candidates.push(resolved);
        }
    } else {
        candidates.push(workspace_root.join(&clean_import));
        candidates.push(workspace_root.join("src").join(&clean_import));
        candidates.push(workspace_root.join("lib").join(&clean_import));
        candidates.push(workspace_root.join("src-tauri").join(&clean_import));
    }

    const ALL_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "py", "rs", "dart", "c", "h", "cpp", "hpp", "cc", "cxx", "hxx"];

    for base in &candidates {
        if let Some(idx) = check_node_existence(base, node_index) {
            return Some(idx);
        }

        for ext in ALL_EXTENSIONS {
            let with_ext = base.with_extension(*ext);
            if let Some(idx) = check_node_existence(&with_ext, node_index) {
                return Some(idx);
            }
        }

        for ext in ALL_EXTENSIONS {
            let index_file = base.join(format!("index.{}", ext));
            if let Some(idx) = check_node_existence(&index_file, node_index) {
                return Some(idx);
            }
            let mod_file = base.join(format!("mod.{}", ext));
            if let Some(idx) = check_node_existence(&mod_file, node_index) {
                return Some(idx);
            }
        }
    }

    let clean_lower = clean_import.to_lowercase();
    for (i, node) in nodes.iter().enumerate() {
        let node_id_lower = node.id.to_lowercase();
        for ext in ALL_EXTENSIONS {
            let suffix_file = format!("/{}.{}", clean_lower, ext);
            let suffix_dir = format!("/{}/index.{}", clean_lower, ext);
            let suffix_mod = format!("/{}/mod.{}", clean_lower, ext);
            if node_id_lower.ends_with(&suffix_file)
                || node_id_lower.ends_with(&suffix_dir)
                || node_id_lower.ends_with(&suffix_mod)
                || node_id_lower.ends_with(&format!("/{}", clean_lower))
            {
                return Some(i);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_normalize_path() {
        let path = PathBuf::from("a/b/../c/./d");
        let normalized = normalize_path(&path);
        let expected = PathBuf::from("a/c/d");
        assert_eq!(normalized, expected);
    }
}
