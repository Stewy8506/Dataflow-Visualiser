use serde::Serialize;
use std::fs;
use std::path::Path;
use ignore::WalkBuilder;
use regex::Regex;

#[derive(Serialize)]
pub struct RefactorImpact {
    pub affected_files: Vec<AffectedFile>,
    pub total_files: usize,
    pub total_estimated_changes: usize,
}

#[derive(Serialize)]
pub struct AffectedFile {
    pub path: String,
    pub label: String,
    pub matches: Vec<RefactorMatch>,
    pub estimated_line_changes: usize,
}

#[derive(Serialize)]
pub struct RefactorMatch {
    pub line: usize,
    pub column: usize,
    pub context: String,
    pub match_type: String,
}

#[tauri::command]
pub async fn preview_refactor(
    workspace_path: String,
    target_path: String,
    _new_name: String,
    symbol_name: Option<String>,
) -> Result<RefactorImpact, String> {
    let mut affected_files = Vec::new();
    let mut total_estimated_changes = 0;

    let target_ref = Path::new(&target_path);
    let target_basename = target_ref.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let target_filename = target_ref.file_name().unwrap_or_default().to_string_lossy().to_string();
    let target_without_ext = target_path
        .replace('\\', "/")
        .trim_end_matches(&target_filename)
        .trim_end_matches('/')
        .to_string();

    let search_term = if let Some(sym) = &symbol_name {
        sym.clone()
    } else {
        target_basename.clone()
    };

    let symbol_re = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(&search_term))).unwrap();
    let file_ref_re = Regex::new(&format!(
        r#"(?i)(from\s+["'][^"']*{}["']|import\(["'][^"']*{}["']\)|require\(["'][^"']*{}["']\))"#,
        regex::escape(&target_basename),
        regex::escape(&target_basename),
        regex::escape(&target_basename)
    ))
    .unwrap();

    let walker = WalkBuilder::new(&workspace_path)
        .hidden(true)
        .git_ignore(true)
        .build();

    for result in walker {
        if let Ok(entry) = result {
            if entry.file_type().is_some_and(|ft| ft.is_file()) {
                let path = entry.path();
                let path_str = path.to_string_lossy().replace('\\', "/");
                
                // Skip the target file itself
                if path_str == target_path.replace('\\', "/") {
                    continue;
                }

                // Only check text/source files
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                if !matches!(ext, "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "dart" | "c" | "cpp" | "h") {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(path) {
                    let mut file_matches = Vec::new();
                    
                    for (i, line) in content.lines().enumerate() {
                        if let Some(mat) = file_ref_re.find(line) {
                            file_matches.push(RefactorMatch {
                                line: i + 1,
                                column: mat.start(),
                                context: line.trim().to_string(),
                                match_type: "import-path".to_string(),
                            });
                            continue;
                        }

                        let normalized_line = line.replace('\\', "/");
                        if !target_without_ext.is_empty() && normalized_line.contains(&target_without_ext) {
                            file_matches.push(RefactorMatch {
                                line: i + 1,
                                column: normalized_line.find(&target_without_ext).unwrap_or(0),
                                context: line.trim().to_string(),
                                match_type: "path-reference".to_string(),
                            });
                            continue;
                        }

                        if let Some(mat) = symbol_re.find(line) {
                            file_matches.push(RefactorMatch {
                                line: i + 1,
                                column: mat.start(),
                                context: line.trim().to_string(),
                                match_type: if line.contains("import ") || line.contains("require(") {
                                    "import-symbol".to_string()
                                } else {
                                    "usage".to_string()
                                },
                            });
                        }
                    }

                    if !file_matches.is_empty() {
                        let changes = file_matches.len();
                        total_estimated_changes += changes;
                        affected_files.push(AffectedFile {
                            path: path_str,
                            label: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                            matches: file_matches,
                            estimated_line_changes: changes,
                        });
                    }
                }
            }
        }
    }

    let total_files = affected_files.len();

    Ok(RefactorImpact {
        affected_files,
        total_files,
        total_estimated_changes,
    })
}
