use crate::state::AppState;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::Read;
use tauri::{Emitter, State, Window};

#[tauri::command]
pub async fn spawn_pty(
    shell: String,
    workspace_path: Option<String>,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&shell);
    if let Some(path) = workspace_path {
        cmd.cwd(std::path::Path::new(&path));
    }
    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    *state.pty_writer.lock().unwrap() = Some(writer);
    *state.pty_master.lock().unwrap() = Some(pair.master);

    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    let _ = window.emit("pty-data", data);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(data: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(writer) = state.pty_writer.lock().unwrap().as_mut() {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_pty(rows: u16, cols: u16, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(master) = state.pty_master.lock().unwrap().as_mut() {
        master
            .resize(portable_pty::PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
