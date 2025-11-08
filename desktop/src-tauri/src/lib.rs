// GoblinOS Desktop Library
// Mobile entry point (currently unused but required by Tauri structure)

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Mobile not supported yet
    unimplemented!("Mobile platform not yet supported for GoblinOS");
}
