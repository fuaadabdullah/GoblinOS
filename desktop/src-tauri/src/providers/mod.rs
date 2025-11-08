// Provider module - abstraction for different AI providers

mod ollama;
mod openai;
mod anthropic;
mod gemini;

pub use ollama::OllamaProvider;
pub use openai::OpenAIProvider;
pub use anthropic::AnthropicProvider;
pub use gemini::GeminiProvider;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub content: String,
    pub model: String,
    pub tokens: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub content: String,
    pub done: bool,
    pub tokens: Option<TokenUsage>,
}

#[async_trait]
pub trait ModelProvider: Send + Sync {
    /// Generate a complete response
    async fn generate(&self, prompt: &str, system: Option<&str>) -> Result<GenerateResponse, Box<dyn std::error::Error>>;

    /// Generate a streaming response
    async fn generate_stream(
        &self,
        prompt: &str,
        system: Option<&str>,
    ) -> Result<
        Box<dyn futures_util::Stream<Item = Result<StreamChunk, Box<dyn std::error::Error>>> + Send + Unpin>,
        Box<dyn std::error::Error>,
    >;

    /// Get provider name
    fn provider_name(&self) -> &str;

    /// Get model name
    fn model_name(&self) -> &str;
}
