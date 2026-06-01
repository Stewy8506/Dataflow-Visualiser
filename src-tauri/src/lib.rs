mod ai;
mod commands;
mod git;
mod parser;
mod pty;
mod state;
mod refactor;
mod snapshots;
mod error;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if let Some(pos) = args.iter().position(|x| x == "--export-graph") {
                if pos + 1 < args.len() {
                    let workspace = args[pos + 1].clone();
                    let handle = app.handle().clone();
                    
                    tauri::async_runtime::block_on(async move {
                        println!("Parsing codebase at {}", workspace);
                        match parser::parse_codebase(handle, workspace.clone()).await {
                            Ok(graph_data) => {
                                let snapshot_name = "ci-export";
                                if let Err(e) = snapshots::save_snapshot(workspace.clone(), snapshot_name.to_string(), graph_data).await {
                                    eprintln!("Failed to save snapshot: {}", e);
                                    std::process::exit(1);
                                }
                                println!("Successfully exported dependency graph to {}/.codemapper/snapshots/{}.data.json", workspace, snapshot_name);
                                std::process::exit(0);
                            }
                            Err(e) => {
                                eprintln!("Failed to parse codebase: {}", e);
                                std::process::exit(1);
                            }
                        }
                    });
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            parser::parse_codebase,
            ai::enrich_graph_with_ai,
            ai::execute_ai_refactor,
            ai::ask_assistant,
            commands::delete_file,
            commands::open_in_ide,
            parser::watch_codebase,
            git::get_git_status,
            git::git_stage_file,
            git::git_unstage_file,
            git::git_commit,
            git::get_git_history,
            git::get_commit_diff,
            git::get_git_churn,
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty,
            refactor::preview_refactor,
            parser::utils::props::trace_prop,
            snapshots::save_snapshot,
            snapshots::list_snapshots,
            snapshots::diff_snapshots
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
