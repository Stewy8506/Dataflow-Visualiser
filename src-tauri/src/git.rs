use git2::{Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository, StatusOptions};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Serialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize)]
pub struct GitCommitInfo {
    pub id: String,
    pub parents: Vec<String>,
    pub author: String,
    pub message: String,
    pub timestamp: i64,
}

#[derive(Serialize)]
pub struct GitSyncResult {
    pub branch: String,
    pub fetched: bool,
    pub pulled: bool,
    pub pushed: bool,
    pub message: String,
}

fn remote_callbacks<'a>() -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        if let Some(username) = username_from_url {
            Cred::ssh_key_from_agent(username).or_else(|_| Cred::default())
        } else {
            Cred::default()
        }
    });
    callbacks
}

#[tauri::command]
pub async fn get_git_status(path: String) -> Result<Vec<GitFileStatus>, String> {
    let repo = Repository::discover(&path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        let mut staged = false;
        let mut status_str = "Unknown";

        if status.intersects(
            git2::Status::INDEX_NEW | git2::Status::INDEX_MODIFIED | git2::Status::INDEX_DELETED,
        ) {
            staged = true;
            if status.contains(git2::Status::INDEX_NEW) {
                status_str = "Added";
            } else if status.contains(git2::Status::INDEX_DELETED) {
                status_str = "Deleted";
            } else {
                status_str = "Modified";
            }
        } else if status.contains(git2::Status::WT_NEW) {
            status_str = "Untracked";
        } else if status.contains(git2::Status::WT_MODIFIED) {
            status_str = "Modified";
        } else if status.contains(git2::Status::WT_DELETED) {
            status_str = "Deleted";
        }

        if status_str != "Unknown" {
            result.push(GitFileStatus {
                path,
                status: status_str.to_string(),
                staged,
            });
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn git_stage_file(workspace: String, path: String) -> Result<(), String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(Path::new(&path))
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn git_unstage_file(workspace: String, path: String) -> Result<(), String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let head = repo
        .head()
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?;
    repo.reset_default(Some(head.as_object()), std::iter::once(path.as_str()))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn git_commit(workspace: String, message: String) -> Result<(), String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let oid = index.write_tree().map_err(|e| e.to_string())?;
    let signature = repo.signature().map_err(|e| e.to_string())?;
    let parent_commit = repo
        .head()
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?;
    let tree = repo.find_tree(oid).map_err(|e| e.to_string())?;

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&parent_commit],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn git_sync(workspace: String) -> Result<GitSyncResult, String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head
        .shorthand()
        .ok_or_else(|| "Detached HEAD cannot be synced".to_string())?
        .to_string();
    drop(head);

    let mut remote = repo.find_remote("origin").map_err(|e| e.to_string())?;

    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(remote_callbacks());
    remote
        .fetch(&[branch.as_str()], Some(&mut fetch_options), None)
        .map_err(|e| e.to_string())?;

    let fetch_ref = format!("refs/remotes/origin/{}", branch);
    let fetch_oid = repo
        .find_reference(&fetch_ref)
        .and_then(|r| r.target().ok_or_else(|| git2::Error::from_str("Missing fetched target")))
        .map_err(|e| e.to_string())?;
    let fetch_commit = repo.find_annotated_commit(fetch_oid).map_err(|e| e.to_string())?;
    let (analysis, _preference) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;

    let pulled = if analysis.is_up_to_date() {
        false
    } else if analysis.is_fast_forward() {
        let local_ref = format!("refs/heads/{}", branch);
        let mut reference = repo.find_reference(&local_ref).map_err(|e| e.to_string())?;
        reference
            .set_target(fetch_oid, "Fast-forward from origin")
            .map_err(|e| e.to_string())?;
        repo.set_head(&local_ref).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| e.to_string())?;
        true
    } else {
        return Err("Remote branch has diverged. Resolve locally before syncing.".to_string());
    };

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(remote_callbacks());
    let push_refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    remote
        .push(&[push_refspec.as_str()], Some(&mut push_options))
        .map_err(|e| e.to_string())?;

    Ok(GitSyncResult {
        branch: branch.clone(),
        fetched: true,
        pulled,
        pushed: true,
        message: format!("Synced {}", branch),
    })
}

#[tauri::command]
pub async fn get_git_history(workspace: String) -> Result<Vec<GitCommitInfo>, String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .unwrap_or(());

    let mut commits = Vec::new();
    for oid in revwalk.take(100).flatten() {
        if let Ok(commit) = repo.find_commit(oid) {
            let id = commit.id().to_string();
            let author = commit.author().name().unwrap_or("Unknown").to_string();
            let message = commit.summary().unwrap_or("").to_string();
            let timestamp = commit.time().seconds();

            let mut parents = Vec::new();
            for parent in commit.parents() {
                parents.push(parent.id().to_string());
            }

            commits.push(GitCommitInfo {
                id,
                parents,
                author,
                message,
                timestamp,
            });
        }
    }

    Ok(commits)
}

#[tauri::command]
pub async fn get_commit_diff(workspace: String, commit_id: String) -> Result<String, String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let oid = git2::Oid::from_str(&commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let parent_tree = if commit.parent_count() > 0 {
        let parent = commit.parent(0).map_err(|e| e.to_string())?;
        Some(parent.tree().map_err(|e| e.to_string())?)
    } else {
        None
    };

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)
        .map_err(|e| e.to_string())?;

    use std::sync::{Arc, Mutex};
    let patch_string = Arc::new(Mutex::new(String::new()));

    let patch_clone = patch_string.clone();
    diff.print(git2::DiffFormat::Patch, |_, _, line| {
        let mut patch = patch_clone.lock().unwrap();
        let prefix = match line.origin() {
            '+' | '-' | ' ' => format!("{}", line.origin()),
            _ => "".to_string(),
        };
        patch.push_str(&prefix);
        patch.push_str(&String::from_utf8_lossy(line.content()));
        true
    })
    .map_err(|e| e.to_string())?;

    let result = patch_string.lock().unwrap().clone();
    Ok(result)
}

#[tauri::command]
pub async fn get_git_churn(workspace: String, limit: usize) -> Result<HashMap<String, usize>, String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    
    let mut churn_map: HashMap<String, usize> = HashMap::new();
    
    for oid in revwalk.take(limit).flatten() {
        if let Ok(commit) = repo.find_commit(oid) {
            let tree = commit.tree().map_err(|e| e.to_string())?;
            
            let parent_tree = if commit.parent_count() > 0 {
                let parent = commit.parent(0).map_err(|e| e.to_string())?;
                Some(parent.tree().map_err(|e| e.to_string())?)
            } else {
                None
            };
            
            if let Ok(diff) = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None) {
                for delta in diff.deltas() {
                    if let Some(path) = delta.new_file().path() {
                        let path_str = path.to_string_lossy().into_owned();
                        *churn_map.entry(path_str).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    
    Ok(churn_map)
}

#[tauri::command]
pub async fn get_git_branch(workspace: String) -> Result<String, String> {
    let repo = Repository::discover(&workspace).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head
        .shorthand()
        .ok_or_else(|| "Detached HEAD".to_string())?
        .to_string();
    Ok(branch)
}
