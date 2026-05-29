use super::{ParsedNode, ParsedEdge};
use std::path::Path;

pub fn resolve_nextjs_edges(nodes: &[ParsedNode], edges: &mut Vec<ParsedEdge>) {
    let mut layout_nodes = Vec::new();
    let mut route_nodes = Vec::new();

    for node in nodes {
        if node.label.starts_with("layout.") {
            layout_nodes.push(node);
        } else if node.label.starts_with("page.")
            || node.label.starts_with("loading.")
            || node.label.starts_with("template.")
            || node.label.starts_with("route.")
            || node.label.starts_with("error.")
            || node.label.starts_with("not-found.")
        {
            route_nodes.push(node);
        }
    }

    for r_node in &route_nodes {
        let mut current_dir = Path::new(&r_node.id).parent();
        let mut found_layout = None;

        while let Some(dir) = current_dir {
            let dir_str = dir.to_string_lossy().replace('\\', "/").to_lowercase();

            if let Some(l) = layout_nodes.iter().find(|l| {
                Path::new(&l.id)
                    .parent()
                    .map(|p| p.to_string_lossy().replace('\\', "/").to_lowercase())
                    == Some(dir_str.clone())
            }) {
                found_layout = Some(l);
                break;
            }
            current_dir = dir.parent();
        }

        if let Some(l) = found_layout {
            edges.push(ParsedEdge {
                source: l.id.clone(),
                target: r_node.id.clone(),
                via: None,
                is_data_source: true,
            });
        }
    }

    for l_node in &layout_nodes {
        let current_dir = Path::new(&l_node.id).parent();
        if let Some(parent_dir) = current_dir.and_then(|p| p.parent()) {
            let mut search_dir = Some(parent_dir);
            let mut found_parent_layout = None;

            while let Some(dir) = search_dir {
                let dir_str = dir.to_string_lossy().replace('\\', "/").to_lowercase();
                if let Some(parent_l) = layout_nodes.iter().find(|l| {
                    Path::new(&l.id)
                        .parent()
                        .map(|p| p.to_string_lossy().replace('\\', "/").to_lowercase())
                        == Some(dir_str.clone())
                }) {
                    found_parent_layout = Some(parent_l);
                    break;
                }
                search_dir = dir.parent();
            }

            if let Some(parent_l) = found_parent_layout {
                let exists = edges
                    .iter()
                    .any(|e| e.source == parent_l.id && e.target == l_node.id);
                if !exists {
                    edges.push(ParsedEdge {
                        source: parent_l.id.clone(),
                        target: l_node.id.clone(),
                        via: None,
                        is_data_source: true,
                    });
                }
            }
        }
    }
}
