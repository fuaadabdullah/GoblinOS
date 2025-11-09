// GoblinOS Desktop Library
// Mobile entry point (currently unused but required by Tauri structure)

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Mobile not supported yet
    unimplemented!("Mobile platform not yet supported for GoblinOS");
}

// Re-export modules for integration tests and library usage
pub mod commands;
pub mod config;
pub mod providers;
pub mod memory;
pub mod cost_tracker;
pub mod orchestration;
