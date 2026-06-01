use std::path::Path;
use std::collections::HashSet;

use crate::parser::{AliasResolver, FileData, ParsedNode};
use super::utils::resolve_import_path;

/// Walk the import specifier list and mark which exports of each file
/// are never consumed by any other file in the project.
pub fn annotate_unused_exports(
    nodes: Vec<ParsedNode>,
    files_data: &[FileData],
    workspace_root: &Path,
    package_name: Option<&str>,
    node_index: &std::collections::HashMap<String, usize>,
    alias_resolver: &AliasResolver,
    ids_to_bypass: &[String],
) -> Vec<ParsedNode> {
    // Collect every "file_id::specifier" pair that is actually imported somewhere
    let mut all_imported_specifiers: HashSet<String> = HashSet::new();

    for file_data in files_data {
        for (source_import, specifier) in &file_data.import_specifiers {
            if let Some(idx) = resolve_import_path(
                &file_data.path,
                workspace_root,
                source_import,
                package_name,
                node_index,
                &nodes,
                alias_resolver,
            ) {
                let target_id = &nodes[idx].id;
                all_imported_specifiers.insert(format!("{}::{}", target_id, specifier));
            }
        }
    }

    // Filter bypassed files and annotate the remaining nodes
    nodes
        .into_iter()
        .filter(|n| !ids_to_bypass.contains(&n.id))
        .map(|mut n| {
            if let Some(file_data) = files_data.iter().find(|f| f.id == n.id) {
                for export in &file_data.exported_symbols {
                    // Skip wildcard and default exports to avoid false positives in Next.js pages
                    if export != "*"
                        && export != "default"
                        && !all_imported_specifiers.contains(&format!("{}::{}", n.id, export))
                    {
                        n.unused_exports.push(export.clone());
                    }
                }
            }
            n
        })
        .collect()
}
