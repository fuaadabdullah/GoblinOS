use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::Mutex;
use futures_util::StreamExt;

use crate::config::GoblinsConfig;
use crate::cost_tracker::{CostTracker, TaskCost, CostSummary};
use crate::memory::{MemoryEntry, MemoryStore};
use crate::orchestration::{OrchestrationParser, OrchestrationPlan};
use crate::providers::{
    AnthropicProvider, GeminiProvider, ModelProvider, OllamaProvider, OpenAIProvider,
};

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
    pub streaming: Option<bool>,
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
    pub cost: Option<TaskCost>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamEvent {
    pub content: String,
    pub done: bool,
}

pub struct GoblinRuntime {
    memory: MemoryStore,
    providers: std::collections::HashMap<String, Box<dyn ModelProvider>>,
    config: GoblinsConfig,
    cost_tracker: CostTracker,
}

impl GoblinRuntime {
    pub async fn new(db_path: &str, config_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let memory = MemoryStore::new(db_path).await?;
        let config = GoblinsConfig::load_from_file(config_path)?;

        let mut providers: std::collections::HashMap<String, Box<dyn ModelProvider>> =
            std::collections::HashMap::new();

        // Initialize Ollama (local, always available)
        providers.insert(
            "ollama".to_string(),
            Box::new(OllamaProvider::new("qwen2.5:3b".to_string())),
        );

        // Initialize OpenAI if API key is available
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
            providers.insert(
                "openai".to_string(),
                Box::new(OpenAIProvider::new(api_key, None)),
            );
        }

        // Initialize Anthropic if API key is available
        if let Ok(api_key) = std::env::var("ANTHROPIC_API_KEY") {
            providers.insert(
                "anthropic".to_string(),
                Box::new(AnthropicProvider::new(api_key, None)),
            );
        }

        // Initialize Gemini if API key is available
        if let Ok(api_key) = std::env::var("GEMINI_API_KEY") {
            providers.insert(
                "gemini".to_string(),
                Box::new(GeminiProvider::new(api_key, None)),
            );
        }

        let cost_tracker = CostTracker::new();

        Ok(Self {
            memory,
            providers,
            config,
            cost_tracker,
        })
    }

    pub async fn list_goblins(&self) -> Vec<GoblinStatus> {
        self.config
            .get_all_goblins()
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

    pub fn list_providers(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }

    pub async fn execute_task(
        &mut self,
        goblin: &str,
        task: &str,
        provider_name: Option<&str>,
    ) -> Result<GoblinResponse, Box<dyn std::error::Error>> {
        let start = std::time::Instant::now();

        let provider_name = provider_name.unwrap_or("ollama");
        let provider = self
            .providers
            .get(provider_name)
            .ok_or_else(|| format!("Provider '{}' not found", provider_name))?;

        let system_prompt = format!(
            "You are {}, a specialized AI goblin. Help the user with their task.",
            goblin
        );

        let response = provider.generate(task, Some(&system_prompt)).await?;

        let duration_ms = start.elapsed().as_millis() as u64;

        // Track costs
        let task_cost = if let Some(tokens) = &response.tokens {
            Some(self.cost_tracker.record_task(
                uuid::Uuid::new_v4().to_string(),
                provider.provider_name().to_string(),
                response.model.clone(),
                tokens.prompt_tokens,
                tokens.completion_tokens,
            ))
        } else {
            None
        };

        // Save to memory
        let entry = MemoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            goblin: goblin.to_string(),
            task: task.to_string(),
            response: response.content.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            kpis: Some(serde_json::json!({
                "duration_ms": duration_ms,
                "provider": provider_name,
                "model": response.model,
                "cost": task_cost,
            }).to_string()),
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
            cost: task_cost,
            model: Some(response.model),
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
        let cost_summary = self.cost_tracker.get_summary();

        Ok(serde_json::json!({
            "total_tasks": cost_summary.total_tasks,
            "total_input_tokens": cost_summary.total_input_tokens,
            "total_output_tokens": cost_summary.total_output_tokens,
            "total_cost": cost_summary.total_cost,
            "cost_by_provider": cost_summary.cost_by_provider,
            "cost_by_model": cost_summary.cost_by_model,
        }))
    }

    pub fn get_cost_summary(&self) -> CostSummary {
        self.cost_tracker.get_summary()
    }

    pub fn parse_orchestration(&self, text: &str, default_goblin: Option<&str>) -> Result<OrchestrationPlan, String> {
        OrchestrationParser::parse(text, default_goblin)
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
pub async fn get_providers(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
) -> Result<Vec<String>, String> {
    let runtime = runtime.lock().await;
    Ok(runtime.list_providers())
}

#[tauri::command]
pub async fn execute_task(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
    app_handle: tauri::AppHandle,
    request: ExecuteRequest,
) -> Result<GoblinResponse, String> {
    // Check if streaming is requested
    if request.streaming.unwrap_or(false) {
        // Execute with streaming
        return execute_task_streaming(runtime, app_handle, request).await;
    }

    // Regular execution
    let mut runtime = runtime.lock().await;
    runtime
        .execute_task(&request.goblin, &request.task, None)
        .await
        .map_err(|e| e.to_string())
}

async fn execute_task_streaming(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
    app_handle: tauri::AppHandle,
    request: ExecuteRequest,
) -> Result<GoblinResponse, String> {
    let start = std::time::Instant::now();
    let task_id = uuid::Uuid::new_v4().to_string();

    // Get provider
    let provider_name = "ollama"; // Default to ollama for now
    let mut full_response = String::new();

    // Clone necessary data before async block
    let goblin = request.goblin.clone();
    let task = request.task.clone();

    {
        let runtime_lock = runtime.lock().await;
        let provider = runtime_lock
            .providers
            .get(provider_name)
            .ok_or_else(|| format!("Provider '{}' not found", provider_name))?;

        let system_prompt = format!(
            "You are {}, a specialized AI goblin. Help the user with their task.",
            goblin
        );

        let mut stream = provider
            .generate_stream(&task, Some(&system_prompt))
            .await
            .map_err(|e| e.to_string())?;

        // Stream tokens to frontend
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    full_response.push_str(&chunk.content);

                    // Emit event to frontend
                    let _ = app_handle.emit(
                        "stream-token",
                        StreamEvent {
                            content: chunk.content,
                            done: chunk.done,
                        },
                    );

                    if chunk.done {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("Stream error: {}", e);
                    break;
                }
            }
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;

    // Save to memory
    let runtime_lock = runtime.lock().await;
    let entry = MemoryEntry {
        id: task_id.clone(),
        goblin: goblin.clone(),
        task: task.clone(),
        response: full_response.clone(),
        timestamp: chrono::Utc::now().timestamp(),
        kpis: Some(serde_json::json!({
            "duration_ms": duration_ms,
            "provider": provider_name,
            "streaming": true,
        }).to_string()),
    };

    runtime_lock.memory.save(&entry).await.map_err(|e| e.to_string())?;

    Ok(GoblinResponse {
        goblin,
        task,
        reasoning: full_response,
        tool: None,
        command: None,
        output: None,
        duration_ms,
        cost: None,
        model: Some(provider_name.to_string()),
    })
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

#[tauri::command]
pub async fn get_cost_summary(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
) -> Result<CostSummary, String> {
    let runtime = runtime.lock().await;
    Ok(runtime.get_cost_summary())
}

#[tauri::command]
pub async fn parse_orchestration(
    runtime: State<'_, Arc<Mutex<GoblinRuntime>>>,
    text: String,
    default_goblin: Option<String>,
) -> Result<OrchestrationPlan, String> {
    let runtime = runtime.lock().await;
    runtime.parse_orchestration(&text, default_goblin.as_deref())
}
