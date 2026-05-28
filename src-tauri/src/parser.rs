use ignore::{DirEntry, WalkBuilder};
use oxc_allocator::Allocator;
use oxc_ast::ast::{ImportDeclarationSpecifier, ModuleDeclaration};
use oxc_parser::Parser;
use oxc_span::SourceType;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Window};
use tree_sitter::Parser as TSParser;

thread_local! {
    static PYTHON_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_python::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
    static RUST_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_rust::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
    static DART_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_dart::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
}

fn extract_imports_with_parser(
    parser: &mut TSParser,
    source_text: &str,
    ext: &str,
    imports: &mut Vec<(String, bool)>,
) {
    if let Some(tree) = parser.parse(source_text, None) {
        let mut cursor = tree.walk();
        let mut reached_root = false;
        while !reached_root {
            let node = cursor.node();
            let kind = node.kind();

            let mut target_node = None;
            if ext == "py" && (kind == "import_statement" || kind == "import_from_statement") {
                target_node = Some(node);
            } else if ext == "rs" && kind == "use_declaration" {
                target_node = Some(node);
            } else if ext == "dart" && kind == "import_or_export" {
                target_node = Some(node);
            }

            if let Some(n) = target_node {
                if let Ok(text) = n.utf8_text(source_text.as_bytes()) {
                    let clean = text
                        .replace("import ", "")
                        .replace("from ", "")
                        .replace("use ", "")
                        .replace(';', "")
                        .replace('\'', "")
                        .replace('"', "");
                    let parts: Vec<&str> = clean.split_whitespace().collect();
                    if parts.len() >= 2 {
                        imports.push((format!("{}/{}", parts[0], parts[1]), false));
                        imports.push((parts[0].to_string(), false));
                    } else if let Some(module) = parts.first() {
                        imports.push((module.to_string(), false));
                    }
                }
            }

            if cursor.goto_first_child() {
                continue;
            }
            if cursor.goto_next_sibling() {
                continue;
            }
            let mut retracing = true;
            while retracing {
                if !cursor.goto_parent() {
                    retracing = false;
                    reached_root = true;
                } else if cursor.goto_next_sibling() {
                    retracing = false;
                }
            }
        }
    }
}

fn is_ignored(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| {
            s.starts_with('.')
                || s == "node_modules"
                || s == "target"
                || s == "dist"
                || s == "build"
                || s.starts_with("next-env")
                || s == "next.config.ts"
                || s == "next.config.js"
        })
        .unwrap_or(false)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        if component.as_os_str() == ".." {
            normalized.pop();
        } else if component.as_os_str() != "." {
            normalized.push(component);
        }
    }
    normalized
}

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
    #[serde(default)]
    pub metrics: Option<NodeMetrics>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParsedEdge {
    pub source: String,
    pub target: String,
    pub via: Option<String>,
    pub is_data_source: bool,
}

pub struct AliasResolver {
    package_paths: HashMap<PathBuf, HashMap<String, Vec<String>>>,
    monorepo_packages: HashMap<String, String>,
    workspace_root: PathBuf,
}

impl AliasResolver {
    pub fn new(workspace_root: &Path) -> Self {
        let mut package_paths = HashMap::new();
        let mut monorepo_packages = HashMap::new();

        for result in ignore::WalkBuilder::new(workspace_root)
            .hidden(true)
            .git_ignore(true)
            .build()
        {
            if let Ok(entry) = result {
                if !entry.path().is_file() {
                    continue;
                }

                let file_name = entry.path().file_name().unwrap_or_default();
                let parent_dir = entry.path().parent().unwrap().to_path_buf();

                if file_name == "tsconfig.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let re_line = Regex::new(r"(?m)//.*$").unwrap();
                        let re_block = Regex::new(r"(?s)/\*.*?\*/").unwrap();
                        let no_block = re_block.replace_all(&content, "");
                        let no_line = re_line.replace_all(&no_block, "");

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&no_line) {
                            if let Some(compiler_options) = json.get("compilerOptions") {
                                if let Some(paths_val) = compiler_options.get("paths") {
                                    if let Ok(paths_map) = serde_json::from_value::<HashMap<String, Vec<String>>>(
                                        paths_val.clone(),
                                    ) {
                                        package_paths
                                            .entry(parent_dir.clone())
                                            .or_insert_with(HashMap::new)
                                            .extend(paths_map);
                                    }
                                }
                            }
                        }
                    }
                } else if file_name == "vite.config.ts" || file_name == "vite.config.js" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let re = Regex::new(r#"["'](@/.*?)["']\s*:\s*["'](.*?)["']"#).unwrap();
                        let mut vite_paths = HashMap::new();
                        for cap in re.captures_iter(&content) {
                            if let (Some(alias), Some(target)) = (cap.get(1), cap.get(2)) {
                                vite_paths.insert(
                                    alias.as_str().to_string(),
                                    vec![target.as_str().to_string()],
                                );
                            }
                        }
                        if !vite_paths.is_empty() {
                            package_paths
                                .entry(parent_dir.clone())
                                .or_insert_with(HashMap::new)
                                .extend(vite_paths);
                        }
                    }
                } else if file_name == "package.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(name) = json.get("name").and_then(|n| n.as_str()) {
                                if let Ok(rel_path) = parent_dir.strip_prefix(workspace_root) {
                                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                                    monorepo_packages.insert(
                                        name.to_string(),
                                        if rel_str.is_empty() {
                                            ".".to_string()
                                        } else {
                                            rel_str
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        Self {
            package_paths,
            monorepo_packages,
            workspace_root: workspace_root.to_path_buf(),
        }
    }

    pub fn resolve(&self, import_str: &str, current_file_path: &Path) -> String {
        for (pkg_name, pkg_path) in &self.monorepo_packages {
            if import_str == pkg_name || import_str.starts_with(&format!("{}/", pkg_name)) {
                let rest = import_str.strip_prefix(pkg_name).unwrap_or("");
                let mut resolved = format!("{}{}", pkg_path, rest);
                if resolved.starts_with("./") {
                    resolved = resolved.strip_prefix("./").unwrap().to_string();
                }
                if resolved == "." {
                    resolved = pkg_path.to_string();
                }
                return resolved;
            }
        }

        // Find closest config by traversing up from current_file_path
        let mut search_dir = current_file_path.parent();
        while let Some(dir) = search_dir {
            if let Some(paths) = self.package_paths.get(dir) {
                for (alias, targets) in paths {
                    let alias_prefix = alias.trim_end_matches('*');
                    if import_str.starts_with(alias_prefix) {
                        if let Some(target) = targets.first() {
                            let target_prefix = target.trim_end_matches('*');
                            let rest = import_str.strip_prefix(alias_prefix).unwrap_or("");
                            let mut resolved = format!("{}{}", target_prefix, rest);
                            if resolved.starts_with("./") {
                                resolved = resolved.strip_prefix("./").unwrap().to_string();
                            }
                            
                            // Make it relative to workspace_root so it resolves properly in the global graph
                            if let Ok(rel) = dir.strip_prefix(&self.workspace_root) {
                                let rel_str = rel.to_string_lossy().replace('\\', "/");
                                if !rel_str.is_empty() {
                                    resolved = format!("{}/{}", rel_str, resolved);
                                }
                            }

                            return resolved;
                        }
                    }
                }
            }
            if dir == self.workspace_root {
                break;
            }
            search_dir = dir.parent();
        }

        import_str.to_string()
    }
}

#[derive(Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<ParsedNode>,
    pub edges: Vec<ParsedEdge>,
}

fn resolve_import_path(
    current_file_path: &Path,
    workspace_root: &Path,
    import_str: &str,
    package_name: Option<&str>,
    node_index: &HashMap<String, usize>,
    nodes: &[ParsedNode],
    alias_resolver: &AliasResolver,
) -> Option<usize> {
    let mut import_path = import_str.replace('\\', "/");

    if import_path.starts_with("package:") {
        if let Some(pkg) = package_name {
            let prefix = format!("package:{}/", pkg);
            if import_path.starts_with(&prefix) {
                let sub_path = import_path.strip_prefix(&prefix).unwrap();
                import_path = format!("lib/{}", sub_path);
            } else {
                return None;
            }
        } else {
            return None;
        }
    }

    if import_path.starts_with("crate::") {
        let sub_path = import_path
            .strip_prefix("crate::")
            .unwrap()
            .replace("::", "/");
        import_path = format!("src/{}", sub_path);
    }

    let mut clean_import = import_path
        .replace("super::", "../")
        .replace("self::", "./")
        .replace("::", "/");

    if clean_import.starts_with('.')
        && (clean_import.ends_with(".py")
            || current_file_path.extension().and_then(|s| s.to_str()) == Some("py"))
    {
        let dots_count = clean_import.chars().take_while(|c| *c == '.').count();
        let path_part = &clean_import[dots_count..];
        let relative_prefix =
            "../".repeat(dots_count - 1) + if dots_count == 1 { "./" } else { "" };
        clean_import = format!("{}{}", relative_prefix, path_part.replace('.', "/"));
    } else if current_file_path.extension().and_then(|s| s.to_str()) == Some("py") {
        clean_import = clean_import.replace('.', "/");
    }

    let resolved_alias = alias_resolver.resolve(&clean_import, current_file_path);
    let clean_import = resolved_alias
        .strip_prefix("@/")
        .or_else(|| resolved_alias.strip_prefix("~/"))
        .unwrap_or(&resolved_alias);

    let mut candidates = Vec::new();

    if clean_import.starts_with('.') {
        if let Some(dir) = current_file_path.parent() {
            let resolved = normalize_path(&dir.join(clean_import));
            candidates.push(resolved);
        }
    } else {
        candidates.push(workspace_root.join(clean_import));
        candidates.push(workspace_root.join("src").join(clean_import));
        candidates.push(workspace_root.join("lib").join(clean_import));
    }

    const ALL_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "py", "rs", "dart"];

    for base in &candidates {
        if let Some(idx) = check_node_existence(base, node_index) {
            return Some(idx);
        }

        for ext in ALL_EXTENSIONS {
            let with_ext = base.with_extension(*ext);
            if let Some(idx) = check_node_existence(&with_ext, node_index) {
                return Some(idx);
            }
        }

        for ext in ALL_EXTENSIONS {
            let index_file = base.join(format!("index.{}", ext));
            if let Some(idx) = check_node_existence(&index_file, node_index) {
                return Some(idx);
            }
            let mod_file = base.join(format!("mod.{}", ext));
            if let Some(idx) = check_node_existence(&mod_file, node_index) {
                return Some(idx);
            }
        }
    }

    let clean_lower = clean_import.to_lowercase();
    for (i, node) in nodes.iter().enumerate() {
        let node_id_lower = node.id.to_lowercase();
        for ext in ALL_EXTENSIONS {
            let suffix_file = format!("/{}.{}", clean_lower, ext);
            let suffix_dir = format!("/{}/index.{}", clean_lower, ext);
            let suffix_mod = format!("/{}/mod.{}", clean_lower, ext);
            if node_id_lower.ends_with(&suffix_file)
                || node_id_lower.ends_with(&suffix_dir)
                || node_id_lower.ends_with(&suffix_mod)
                || node_id_lower.ends_with(&format!("/{}", clean_lower))
            {
                return Some(i);
            }
        }
    }

    None
}

fn check_node_existence(path: &Path, node_index: &HashMap<String, usize>) -> Option<usize> {
    let key = path.to_string_lossy().replace('\\', "/").to_lowercase();
    node_index.get(&key).copied()
}

use tauri_plugin_fs::FsExt;

#[tauri::command]
pub async fn parse_codebase(app: tauri::AppHandle, path: String) -> Result<GraphData, String> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err("Path does not exist".to_string());
    }

    if let Some(scope) = app.try_fs_scope() {
        if !scope.is_allowed(path_ref) {
            return Err("Access denied by Tauri fs capability scope".to_string());
        }
    }

    let alias_resolver = AliasResolver::new(path_ref);

    let mut package_name = None;
    let pubspec_path = path_ref.join("pubspec.yaml");
    if pubspec_path.exists() {
        if let Ok(content) = fs::read_to_string(pubspec_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("name:") {
                    let parts: Vec<&str> = trimmed.split(':').collect();
                    if parts.len() >= 2 {
                        package_name = Some(parts[1].trim().to_string());
                    }
                    break;
                }
            }
        }
    }

    struct FileData {
        id: String,
        path: PathBuf,
        imports: Vec<(String, bool)>,
        is_barrel_file: bool,
        is_router: bool,
    }

    let mut files_data = Vec::new();

    for result in WalkBuilder::new(path_ref)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(|e| !is_ignored(e))
        .build()
    {
        if let Ok(entry) = result {
            let file_path = entry.path();
            if file_path.is_file() {
                let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("");
                if matches!(ext, "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "dart") {
                    let id = file_path.to_string_lossy().replace('\\', "/");
                    let label = file_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    nodes.push(ParsedNode {
                        id: id.clone(),
                        label,
                        group: ext.to_string(),
                        semantic_group: None,
                        summary: None,
                        metrics: None,
                    });

                    let mut imports = Vec::new();
                    let mut is_barrel_file = false;
                    let is_router = false;
                    let mut function_count = 0;

                    if let Ok(source_text) = fs::read_to_string(file_path) {
                        let re = Regex::new(
                            r"(?m)(?:^|\s)(?:function\s+\w+|=>|fn\s+\w+|def\s+\w+|class\s+\w+)",
                        )
                        .unwrap();
                        function_count = re.find_iter(&source_text).count();

                        if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                            let allocator = Allocator::default();
                            let source_type = SourceType::from_path(file_path).unwrap_or_default();
                            let ret = Parser::new(&allocator, &source_text, source_type).parse();

                            if ret.errors.is_empty() {
                                let program = ret.program;
                                let mut all_exports_imports = true;
                                let mut has_exports = false;

                                for stmt in &program.body {
                                    if let Some(decl) = stmt.as_module_declaration() {
                                        match decl {
                                            ModuleDeclaration::ImportDeclaration(import_decl) => {
                                                let source = import_decl.source.value.to_string();
                                                let mut local_names = Vec::new();
                                                if let Some(specifiers) = &import_decl.specifiers {
                                                    for spec in specifiers {
                                                        match spec {
                                                            ImportDeclarationSpecifier::ImportSpecifier(s) => {
                                                                local_names.push(s.local.name.to_string());
                                                            }
                                                            ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                                                                local_names.push(s.local.name.to_string());
                                                            }
                                                            ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                                                                local_names.push(s.local.name.to_string());
                                                            }
                                                        }
                                                    }
                                                }

                                                let mut is_data_source = false;
                                                for name in local_names {
                                                    let jsx_pattern = format!("<{}", name);
                                                    let call_pattern = format!("{}(", name);
                                                    let call_pattern_space = format!("{} (", name);

                                                    if (source_text.contains(&call_pattern)
                                                        || source_text
                                                            .contains(&call_pattern_space))
                                                        && !source_text.contains(&jsx_pattern)
                                                    {
                                                        is_data_source = true;
                                                        break;
                                                    }
                                                }

                                                imports.push((source, is_data_source));
                                            }
                                            ModuleDeclaration::ExportAllDeclaration(_) => {
                                                has_exports = true;
                                            }
                                            ModuleDeclaration::ExportNamedDeclaration(named) => {
                                                if named.source.is_some() {
                                                    has_exports = true;
                                                } else {
                                                    all_exports_imports = false;
                                                }
                                            }
                                            ModuleDeclaration::ExportDefaultDeclaration(_) => {
                                                all_exports_imports = false;
                                            }
                                            _ => {
                                                all_exports_imports = false;
                                            }
                                        }
                                    } else {
                                        all_exports_imports = false;
                                    }
                                }

                                if all_exports_imports && has_exports {
                                    is_barrel_file = true;
                                }
                            }
                        } else if matches!(ext, "py" | "rs" | "dart") {
                            match ext {
                                "py" => PYTHON_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                "rs" => RUST_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                "dart" => DART_PARSER.with(|p| {
                                    extract_imports_with_parser(
                                        &mut p.borrow_mut(),
                                        &source_text,
                                        ext,
                                        &mut imports,
                                    );
                                }),
                                _ => unreachable!(),
                            }
                        }
                    }

                    let import_count = imports.len();
                    let score = if function_count > 10 || import_count > 15 {
                        "High"
                    } else if function_count > 3 || import_count > 5 {
                        "Medium"
                    } else {
                        "Low"
                    };

                    if let Some(node) = nodes.last_mut() {
                        node.metrics = Some(NodeMetrics {
                            function_count,
                            import_count,
                            complexity_score: score.to_string(),
                        });
                    }

                    files_data.push(FileData {
                        id,
                        path: file_path.to_path_buf(),
                        imports,
                        is_barrel_file,
                        is_router,
                    });
                }
            }
        }
    }

    let node_index: HashMap<String, usize> = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.to_lowercase(), i))
        .collect();

    for file_data in &files_data {
        for import_str in &file_data.imports {
            if let Some(idx) = resolve_import_path(
                &file_data.path,
                path_ref,
                &import_str.0,
                package_name.as_deref(),
                &node_index,
                &nodes,
                &alias_resolver,
            ) {
                edges.push(ParsedEdge {
                    source: file_data.id.clone(),
                    target: nodes[idx].id.clone(),
                    via: None,
                    is_data_source: import_str.1,
                });
            }
        }
    }

    let is_nextjs = nodes
        .iter()
        .any(|n| n.label.starts_with("layout.") || n.label.starts_with("page."));

    if is_nextjs {
        let mut layout_nodes = Vec::new();
        let mut route_nodes = Vec::new();

        for node in &nodes {
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

    let barrel_ids: Vec<String> = files_data
        .iter()
        .filter(|f| f.is_barrel_file)
        .map(|f| f.id.clone())
        .collect();

    let router_ids: Vec<String> = files_data
        .iter()
        .filter(|f| {
            let is_api_route =
                f.id.contains("/api/") || f.id.contains("route.ts") || f.id.contains("route.js");
            f.is_router || is_api_route
        })
        .map(|f| f.id.clone())
        .collect();

    let mut ids_to_bypass = barrel_ids.clone();
    ids_to_bypass.extend(router_ids.clone());

    let mut final_edges = edges;

    for bypass_id in &ids_to_bypass {
        let incoming: Vec<ParsedEdge> = final_edges
            .iter()
            .filter(|e| e.target == *bypass_id)
            .cloned()
            .collect();

        let outgoing: Vec<ParsedEdge> = final_edges
            .iter()
            .filter(|e| e.source == *bypass_id)
            .cloned()
            .collect();

        for inc in &incoming {
            for out in &outgoing {
                if inc.source != out.target {
                    let mut new_via = inc.via.clone();
                    let proxy_filename = Path::new(bypass_id)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    if new_via.is_none() {
                        new_via = Some(proxy_filename);
                    } else {
                        new_via = Some(format!("{}, {}", new_via.unwrap(), proxy_filename));
                    }

                    final_edges.push(ParsedEdge {
                        source: inc.source.clone(),
                        target: out.target.clone(),
                        via: new_via,
                        is_data_source: inc.is_data_source || out.is_data_source,
                    });
                }
            }
        }

        final_edges.retain(|e| e.source != *bypass_id && e.target != *bypass_id);
    }

    let final_nodes: Vec<ParsedNode> = nodes
        .into_iter()
        .filter(|n| !ids_to_bypass.contains(&n.id))
        .collect();

    Ok(GraphData {
        nodes: final_nodes,
        edges: final_edges,
    })
}

#[derive(Serialize, Clone)]
struct NodeUpdatedPayload {
    node: ParsedNode,
    resolved_imports: Vec<(String, bool)>,
}

#[tauri::command]
pub async fn watch_codebase(path: String, window: Window) -> Result<(), String> {
    use notify::{EventKind, RecursiveMode, Watcher};

    tauri::async_runtime::spawn(async move {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = notify::recommended_watcher(tx).unwrap();

        let path_ref = Path::new(&path);
        let _ = watcher.watch(path_ref, RecursiveMode::Recursive);

        for res in rx {
            if let Ok(event) = res {
                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                    for path_buf in event.paths {
                        if !path_buf.is_file() {
                            continue;
                        }
                        let ext = path_buf.extension().and_then(|s| s.to_str()).unwrap_or("");
                        if !matches!(ext, "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "dart") {
                            continue;
                        }

                        let id = path_buf.to_string_lossy().replace('\\', "/");
                        let label = path_buf
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();

                        let mut imports = Vec::new();
                        let mut function_count = 0;

                        if let Ok(source_text) = fs::read_to_string(&path_buf) {
                            let re = Regex::new(
                                r"(?m)(?:^|\s)(?:function\s+\w+|=>|fn\s+\w+|def\s+\w+|class\s+\w+)",
                            )
                            .unwrap();
                            function_count = re.find_iter(&source_text).count();

                            if matches!(ext, "js" | "ts" | "jsx" | "tsx") {
                                let allocator = Allocator::default();
                                let source_type =
                                    SourceType::from_path(&path_buf).unwrap_or_default();
                                let ret =
                                    Parser::new(&allocator, &source_text, source_type).parse();

                                if ret.errors.is_empty() {
                                    for stmt in &ret.program.body {
                                        if let Some(decl) = stmt.as_module_declaration() {
                                            if let ModuleDeclaration::ImportDeclaration(
                                                import_decl,
                                            ) = decl
                                            {
                                                let source = import_decl.source.value.to_string();
                                                imports.push((source, false));
                                            }
                                        }
                                    }
                                }
                            } else {
                                match ext {
                                    "py" => PYTHON_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    "rs" => RUST_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    "dart" => DART_PARSER.with(|p| {
                                        extract_imports_with_parser(
                                            &mut p.borrow_mut(),
                                            &source_text,
                                            ext,
                                            &mut imports,
                                        )
                                    }),
                                    _ => {}
                                }
                            }
                        }

                        let import_count = imports.len();
                        let score = if function_count > 10 || import_count > 15 {
                            "High"
                        } else if function_count > 3 || import_count > 5 {
                            "Medium"
                        } else {
                            "Low"
                        };

                        let node = ParsedNode {
                            id: id.clone(),
                            label,
                            group: ext.to_string(),
                            semantic_group: None,
                            summary: None,
                            metrics: Some(NodeMetrics {
                                function_count,
                                import_count,
                                complexity_score: score.to_string(),
                            }),
                        };

                        let alias_resolver = AliasResolver::new(path_ref);
                        let mut resolved_imports = Vec::new();
                        for (imp, is_data) in imports {
                            let resolved = alias_resolver.resolve(&imp, &path_buf);
                            let clean = resolved
                                .strip_prefix("@/")
                                .or_else(|| resolved.strip_prefix("~/"))
                                .unwrap_or(&resolved);
                            resolved_imports.push((clean.to_string(), is_data));
                        }

                        let _ = window.emit(
                            "node_updated",
                            NodeUpdatedPayload {
                                node,
                                resolved_imports,
                            },
                        );
                    }
                }
            }
        }
    });

    Ok(())
}
