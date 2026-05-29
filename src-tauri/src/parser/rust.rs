use tree_sitter::Parser as TSParser;

thread_local! {
    pub static RUST_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_rust::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
}
