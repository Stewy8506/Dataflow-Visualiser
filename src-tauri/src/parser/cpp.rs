use tree_sitter::Parser as TSParser;

thread_local! {
    pub static C_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_c::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
    pub static CPP_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_cpp::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
}
