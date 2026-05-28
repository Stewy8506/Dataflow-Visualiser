use portable_pty::MasterPty;
use std::io::Write;

pub struct AppState {
    pub pty_writer: std::sync::Arc<std::sync::Mutex<Option<Box<dyn Write + Send>>>>,
    pub pty_master: std::sync::Arc<std::sync::Mutex<Option<Box<dyn MasterPty + Send>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            pty_writer: std::sync::Arc::new(std::sync::Mutex::new(None)),
            pty_master: std::sync::Arc::new(std::sync::Mutex::new(None)),
        }
    }
}
