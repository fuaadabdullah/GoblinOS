// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Environment variables for AI providers (optional):
// - OPENAI_API_KEY: OpenAI API key for GPT-4/GPT-3.5 models
// - ANTHROPIC_API_KEY: Anthropic API key for Claude models
// - GEMINI_API_KEY: Google Gemini API key
// If not set, only local Ollama provider will be available

mod commands;
mod config;
mod cost_tracker;
mod memory;
mod orchestration;
mod providers;

use commands::GoblinRuntime;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    // Get app data directory for SQLite database
    let app_data_dir = dirs::home_dir()
        .expect("Failed to get home directory")
        .join(".goblinos");

    if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        eprintln!("Failed to create app data directory: {}", e);
    }

    let db_path = app_data_dir.join("goblin-memory.db");
    let db_path_str = db_path.to_str().expect("Invalid db path");
    println!("Using database at: {}", db_path_str);

    // Path to goblins.yaml (relative to workspace root)
    let config_path = std::env::current_dir()
        .expect("Failed to get current directory")
        .join("../../goblins.yaml");
    let config_path_str = config_path.to_str().expect("Invalid config path");
    println!("Loading goblins config from: {}", config_path_str);

    // Initialize GoblinRuntime
    let runtime = Arc::new(Mutex::new(
        GoblinRuntime::new(db_path_str, config_path_str)
            .await
            .expect("Failed to initialize GoblinRuntime"),
    ));

    // Build Tauri app with optional plugins gated by cargo features
    let mut builder = tauri::Builder::default();

    #[cfg(feature = "opener")]
    {
        builder = builder.plugin(tauri_plugin_opener::init());
    }

    #[cfg(feature = "shell")]
    {
        builder = builder.plugin(tauri_plugin_shell::init());
    }

    builder
        .manage(runtime)
        .invoke_handler(tauri::generate_handler![
            commands::get_goblins,
            commands::get_providers,
            commands::get_provider_models,
            commands::execute_task,
            commands::get_history,
            commands::get_stats,
            commands::get_cost_summary,
            commands::parse_orchestration,
            // Secure key storage
            commands::store_api_key,
            commands::get_api_key,
            commands::clear_api_key,
            commands::set_provider_api_key,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
