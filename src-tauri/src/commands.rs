#[tauri::command]
pub async fn delete_file(workspace: String, path: String) -> Result<(), String> {
    let safe_path = crate::security::ensure_path_in_workspace(&workspace, &path)?;
    std::fs::remove_file(safe_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_in_ide(path: String, ide: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("cmd")
        .args(["/C", &ide, &path])
        .spawn();

    #[cfg(not(target_os = "windows"))]
    let status = std::process::Command::new(&ide).arg(&path).spawn();

    status.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_file_content(workspace: String, path: String) -> Result<String, String> {
    let safe_path = crate::security::ensure_path_in_workspace(&workspace, &path)?;
    std::fs::read_to_string(safe_path).map_err(|e| e.to_string())
}
