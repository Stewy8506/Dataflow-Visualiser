mod ai;
mod commands;
mod git;
mod parser;
mod pty;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            parser::parse_codebase,
            ai::enrich_graph_with_ai,
            commands::delete_file,
            commands::open_in_ide,
            parser::watch_codebase,
            git::get_git_status,
            git::git_stage_file,
            git::git_unstage_file,
            git::git_commit,
            git::get_git_history,
            git::get_commit_diff,
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
