use tree_sitter::Parser as TSParser;

thread_local! {
    pub static CSHARP_PARSER: std::cell::RefCell<TSParser> = {
        let mut p = TSParser::new();
        p.set_language(&tree_sitter::Language::from(tree_sitter_c_sharp::LANGUAGE)).unwrap();
        std::cell::RefCell::new(p)
    };
}
