use std::path::{Path, PathBuf};

fn canonical_or_parent(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return path.canonicalize().map_err(|e| e.to_string());
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Path has no parent directory".to_string())?;
    let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    let filename = path
        .file_name()
        .ok_or_else(|| "Path has no filename".to_string())?;
    Ok(canonical_parent.join(filename))
}

pub fn ensure_path_in_workspace(workspace: &str, path: &str) -> Result<PathBuf, String> {
    let workspace_path = Path::new(workspace)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace path: {}", e))?;
    let target_path = canonical_or_parent(Path::new(path))?;

    if target_path.starts_with(&workspace_path) {
        Ok(target_path)
    } else {
        Err("Refusing to access a path outside the selected workspace".to_string())
    }
}

pub fn ensure_workspace_child(workspace: &str, relative: &str) -> Result<PathBuf, String> {
    let workspace_path = Path::new(workspace)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace path: {}", e))?;
    let target = workspace_path.join(relative);
    let resolved = canonical_or_parent(&target)?;

    if resolved.starts_with(&workspace_path) {
        Ok(resolved)
    } else {
        Err("Refusing to create a path outside the selected workspace".to_string())
    }
}
