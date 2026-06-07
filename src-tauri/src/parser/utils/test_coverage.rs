use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use ignore::WalkBuilder;
use crate::parser::utils::utils::is_ignored;

#[derive(Serialize, Deserialize, Clone)]
pub struct TestCoverageInfo {
    pub covered: bool,
    pub score: f32, // 0.0 to 1.0
    pub coverage_type: String, // "actual" or "heuristic"
    pub test_files: Vec<String>,
}

#[tauri::command]
pub async fn compute_test_coverage(workspace: String) -> Result<HashMap<String, TestCoverageInfo>, String> {
    let workspace_path = Path::new(&workspace);
    let mut coverage_map: HashMap<String, TestCoverageInfo> = HashMap::new();

    // 1. Try to find actual coverage reports
    let lcov_path = workspace_path.join("coverage").join("lcov.info");
    let go_cov_path = workspace_path.join("coverage.out");

    let mut found_actual = false;

    if lcov_path.exists() {
        if let Ok(content) = fs::read_to_string(&lcov_path) {
            parse_lcov(&content, &workspace, &mut coverage_map);
            found_actual = true;
        }
    } else if let Ok(content) = fs::read_to_string(&workspace_path.join("lcov.info")) {
        parse_lcov(&content, &workspace, &mut coverage_map);
        found_actual = true;
    }

    if go_cov_path.exists() {
        if let Ok(content) = fs::read_to_string(&go_cov_path) {
            parse_go_cov(&content, &workspace, &mut coverage_map);
            found_actual = true;
        }
    }

    if found_actual {
        return Ok(coverage_map);
    }

    // 2. Fallback to heuristic approach
    let mut all_files = HashSet::new();
    let mut test_files = Vec::new();

    for result in WalkBuilder::new(workspace_path)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(|e| !is_ignored(e, false))
        .build()
    {
        if let Ok(entry) = result {
            if entry.path().is_file() {
                let path_str = entry.path().to_string_lossy().replace('\\', "/");
                all_files.insert(path_str.clone());
                
                if path_str.contains(".test.") || path_str.contains(".spec.") || path_str.contains("_test.") || path_str.contains("/__tests__/") || path_str.contains("/tests/") {
                    test_files.push(path_str);
                }
            }
        }
    }

    for test_file in test_files {
        // Find corresponding source file by replacing .test., .spec., etc.
        let source_candidates = vec![
            test_file.replace(".test.", "."),
            test_file.replace(".spec.", "."),
            test_file.replace("_test.", "."),
            test_file.replace("/__tests__/", "/"),
            test_file.replace("/tests/", "/src/"),
        ];

        let mut matched_src = None;
        for candidate in source_candidates {
            if candidate != test_file && all_files.contains(&candidate) {
                matched_src = Some(candidate);
                break;
            }
        }

        if let Some(src) = matched_src {
            let entry = coverage_map.entry(src).or_insert(TestCoverageInfo {
                covered: true,
                score: 0.0,
                coverage_type: "heuristic".to_string(),
                test_files: Vec::new(),
            });
            entry.test_files.push(test_file.clone());
            entry.score = 1.0;
        }
    }

    Ok(coverage_map)
}

fn parse_lcov(content: &str, workspace: &str, coverage_map: &mut HashMap<String, TestCoverageInfo>) {
    let mut current_file = String::new();
    let mut lh = 0.0;
    let mut lf = 0.0;

    for line in content.lines() {
        if line.starts_with("SF:") {
            current_file = line[3..].to_string();
            // Try to make it an absolute path or relative to workspace
            let p = Path::new(&current_file);
            if !p.is_absolute() {
                current_file = Path::new(workspace).join(p).to_string_lossy().replace('\\', "/");
            } else {
                current_file = current_file.replace('\\', "/");
            }
            lh = 0.0;
            lf = 0.0;
        } else if line.starts_with("LH:") {
            lh = line[3..].parse().unwrap_or(0.0);
        } else if line.starts_with("LF:") {
            lf = line[3..].parse().unwrap_or(0.0);
        } else if line == "end_of_record" {
            if !current_file.is_empty() && lf > 0.0 {
                coverage_map.insert(current_file.clone(), TestCoverageInfo {
                    covered: lh > 0.0,
                    score: lh / lf,
                    coverage_type: "actual".to_string(),
                    test_files: Vec::new(),
                });
            }
        }
    }
}

fn parse_go_cov(content: &str, workspace: &str, coverage_map: &mut HashMap<String, TestCoverageInfo>) {
    // go test -coverprofile=coverage.out
    // mode: set
    // github.com/user/project/file.go:1.1,2.2 1 1
    for line in content.lines() {
        if line.starts_with("mode:") { continue; }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let file_part = parts[0].split(':').next().unwrap_or("");
            // In Go coverage, file_part is the module path (e.g. github.com/repo/src/file.go)
            // It's hard to precisely map to local workspace without knowing module name, but we can do a suffix match.
            // For simplicity, we just extract the file name and do a best effort.
            
            // Just assume it ends with something we can map later, or for now, we construct a dummy path
            let file_name = Path::new(file_part).file_name().and_then(|s| s.to_str()).unwrap_or("");
            // Python imports are resolved conservatively because module roots can vary by project.
            let dummy_path = format!("{}/{}", workspace, file_name);
            
            let covered_stmts: f32 = parts[2].parse().unwrap_or(0.0);
            let total_stmts: f32 = parts[1].parse().unwrap_or(0.0);
            
            if total_stmts > 0.0 {
                let score = covered_stmts / total_stmts;
                coverage_map.insert(dummy_path.replace('\\', "/"), TestCoverageInfo {
                    covered: covered_stmts > 0.0,
                    score,
                    coverage_type: "actual".to_string(),
                    test_files: Vec::new(),
                });
            }
        }
    }
}
