use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::config::GoblinsConfig;
use crate::memory::{MemoryEntry, MemoryStore};
use crate::providers::{GenerateResponse, ModelProvider, OllamaProvider};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoblinStatus {
    pub id: String,
    pub name: String,
    pub title: String,
    pub status: String,
    pub guild: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub goblin: String,
    pub task: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoblinResponse {
    pub goblin: String,
    pub task: String,
    pub reasoning: String,
    pub tool: Option<String>,
    pub command: Option<String>,
    pub output: Option<String>,
    pub duration_ms: u64,
}

pub struct GoblinRuntime {
    memory: MemoryStore,
    provider: Box<dyn ModelProvider>,
    config: GoblinsConfig,
}

impl GoblinRuntime {
    pub async fn new(db_path: &str, config_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let memory = MemoryStore::new(db_path).await?;
        let provider: Box<dyn ModelProvider> = Box::new(OllamaProvider::new("qwen2.5:3b".to_string()));
        let config = GoblinsConfig::load_from_file(config_path)?;

        Ok(Self { memory, provider, config })
    }

    pub async fn list_goblins(&self) -> Vec<GoblinStatus> {
        // Load from goblins.yaml
        self.config.get_all_goblins()
            .into_iter()
            .map(|g| GoblinStatus {
                id: g.id,
                name: g.name,
                title: g.title,
                status: "idle".to_string(),
                guild: g.guild,
            })
            .collect()
    }

    pub async fn execute_task(
        &mut self,
        goblin: &str,
        task: &str,
    ) -> Result<GoblinResponse, Box<dyn std::error::Error>> {
        let start = std::time::Instant::now();

        let system_prompt = format!(
            "You are {}, a specialized AI goblin. Help the user with their task.",
            goblin
        );

        let response: GenerateResponse = self.provider.generate(task, Some(&system_prompt)).await?;

        let duration_ms = start.elapsed().as_millis() as u64;

        // Save to memory
        let entry = MemoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            goblin: goblin.to_string(),
            task: task.to_string(),
            response: response.content.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            kpis: Some(format!(r#"{{"duration_ms": {}}}"#, duration_ms)),
        };

        self.memory.save(&entry).await?;

        Ok(GoblinResponse {
            goblin: goblin.to_string(),
            task: task.to_string(),
            reasoning: response.content,
            tool: None,
            command: None,
            output: None,
            duration_ms,
        })
    }

    pub async fn get_history(
        &self,
        goblin: &str,
        limit: i32,
    ) -> Result<Vec<MemoryEntry>, Box<dyn std::error::Error>> {
        Ok(self.memory.get_history(goblin, limit).await?)
    }

    pub async fn get_stats(
        &self,
        _goblin: &str,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // Placeholder stats
        Ok(serde_json::json!({
            "total_tasks": 0,
            "success_rate": 1.0,
            "avg_duration_ms": 0
        }))
    }
}

// Tauri commands
#[tauri::command]
pub async fn get_goblins(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
) -> Result<Vec<GoblinStatus>, String> {
    let runtime = runtime.lock().await;
    Ok(runtime.list_goblins().await)
}

#[tauri::command]
pub async fn execute_task(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
    request: ExecuteRequest,
) -> Result<GoblinResponse, String> {
    let mut runtime = runtime.lock().await;
    runtime
        .execute_task(&request.goblin, &request.task)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_history(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
    goblin: String,
    limit: i32,
) -> Result<Vec<MemoryEntry>, String> {
    let runtime = runtime.lock().await;
    runtime
        .get_history(&goblin, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_stats(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
    goblin: String,
) -> Result<serde_json::Value, String> {
    let runtime = runtime.lock().await;
    runtime
        .get_stats(&goblin)
        .await
        .map_err(|e| e.to_string())
}
