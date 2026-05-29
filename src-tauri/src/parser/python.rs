use tree_sitter::Parser as TSParser;

thread_local! {
    pub static PYTHON_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_python::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
}
