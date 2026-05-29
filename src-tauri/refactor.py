import os
import re

with open("src/parser.rs", "r", encoding="utf-8") as f:
    original = f.read()

# We need to construct mod.rs
mod_rs = """pub mod cpp;
pub mod dart;
pub mod javascript;
pub mod nextjs;
pub mod python;
pub mod rust;
pub mod tree_sitter_utils;
pub mod utils;

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Window};
use ignore::WalkBuilder;
use tauri_plugin_fs::FsExt;

use utils::{is_ignored, normalize_path, resolve_import_path, check_node_existence};
use nextjs::resolve_nextjs_edges;
use javascript::extract_javascript_imports;
use tree_sitter_utils::extract_imports_with_parser;
use python::PYTHON_PARSER;
use rust::RUST_PARSER;
use dart::DART_PARSER;
use cpp::{C_PARSER, CPP_PARSER};

"""

# Extract the Structs and AliasResolver from original parser.rs
structs_match = re.search(r'(#\[derive\(Serialize, Deserialize, Clone, Default\)\].*?pub struct GraphData \{.*?\})', original, re.DOTALL)
if structs_match:
    mod_rs += structs_match.group(1) + "\n\n"

alias_resolver_match = re.search(r'(pub struct AliasResolver \{.*?\}\n\nimpl AliasResolver \{.*?\}\n\})', original, re.DOTALL)
if alias_resolver_match:
    mod_rs += alias_resolver_match.group(1) + "\n\n"

parse_codebase_match = re.search(r'(#\[tauri::command\]\npub async fn parse_codebase.*?)(#\[derive\(Serialize, Clone\)\])', original, re.DOTALL)
if parse_codebase_match:
    pc = parse_codebase_match.group(1)
    
    # Replace javascript logic
    pc = re.sub(r'let allocator = Allocator::default\(\);.*?if all_exports_imports && has_exports \{\s*is_barrel_file = true;\s*\}',
                r'let (barrel, exports) = extract_javascript_imports(&source_text, &file_path, &mut imports);\n                            is_barrel_file = barrel;', pc, flags=re.DOTALL)
    
    # Remove the Next.js logic block
    pc = re.sub(r'let is_nextjs = nodes.*?if is_nextjs \{.*?\}\n\n    let barrel_ids', 
                r'resolve_nextjs_edges(&nodes, &mut edges);\n\n    let barrel_ids', pc, flags=re.DOTALL)
    
    mod_rs += pc + "\n"

watch_codebase_match = re.search(r'(#\[derive\(Serialize, Clone\)\].*?watch_codebase.*?Ok\(\(\)\)\n\})', original, re.DOTALL)
if watch_codebase_match:
    wc = watch_codebase_match.group(1)
    wc = re.sub(r'let allocator = Allocator::default\(\);.*?if ret\.errors\.is_empty\(\) \{.*?\}',
                r'let _ = extract_javascript_imports(&source_text, &path_buf, &mut imports);', wc, flags=re.DOTALL)
    mod_rs += wc + "\n"

with open("src/parser/mod.rs", "w", encoding="utf-8") as f:
    f.write(mod_rs)

print("Generated src/parser/mod.rs")
