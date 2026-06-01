use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct NodeMetrics {
    pub function_count: usize,
    pub import_count: usize,
    pub complexity_score: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedNode {
    pub id: String,
    pub label: String,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unused_exports: Vec<String>,
    #[serde(default)]
    pub metrics: Option<NodeMetrics>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub vulnerabilities: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedEdge {
    pub source: String,
    pub target: String,
    pub via: Option<String>,
    pub is_data_source: bool,
}

pub struct FileData {
    pub id: String,
    pub path: PathBuf,
    pub imports: Vec<(String, bool)>,
    pub api_calls: Vec<String>,
    pub api_endpoints: Vec<String>,
    pub exported_symbols: Vec<String>,
    pub import_specifiers: Vec<(String, String)>,
    pub is_barrel_file: bool,
    pub is_router: bool,
    #[allow(dead_code)]
    pub tags: Vec<String>,
    pub express_routes: Vec<(String, String)>,
}

#[derive(Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<ParsedNode>,
    pub edges: Vec<ParsedEdge>,
}
