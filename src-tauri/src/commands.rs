#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
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
pub async fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
