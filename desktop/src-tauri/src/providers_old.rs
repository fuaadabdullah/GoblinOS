use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub content: String,
    pub tokens: TokenUsage,
}

#[async_trait]
pub trait ModelProvider: Send + Sync {
    async fn generate(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
    ) -> Result<GenerateResponse, Box<dyn Error>>;

    async fn generate_stream(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
    ) -> Result<tokio::sync::mpsc::Receiver<String>, Box<dyn Error>>;
}

pub struct OllamaProvider {
    base_url: String,
    model: String,
}

impl OllamaProvider {
    pub fn new(model: String) -> Self {
        Self {
            base_url: "http://localhost:11434".to_string(),
            model,
        }
    }
}

#[async_trait]
impl ModelProvider for OllamaProvider {
    async fn generate(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
    ) -> Result<GenerateResponse, Box<dyn Error>> {
        let client = reqwest::Client::new();
        let mut messages = vec![];

        if let Some(sys) = system_prompt {
            messages.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }

        messages.push(serde_json::json!({
            "role": "user",
            "content": prompt
        }));

        let response = client
            .post(format!("{}/api/chat", self.base_url))
            .json(&serde_json::json!({
                "model": self.model,
                "messages": messages,
                "stream": false
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let content = response["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        // Ollama doesn't return token counts by default
        let tokens = TokenUsage {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
        };

        Ok(GenerateResponse { content, tokens })
    }

    async fn generate_stream(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
    ) -> Result<tokio::sync::mpsc::Receiver<String>, Box<dyn Error>> {
        let (tx, rx) = tokio::sync::mpsc::channel(100);

        let base_url = self.base_url.clone();
        let model = self.model.clone();
        let prompt = prompt.to_string();
        let system_prompt = system_prompt.map(|s| s.to_string());

        tokio::spawn(async move {
            let client = reqwest::Client::new();
            let mut messages = vec![];

            if let Some(sys) = system_prompt {
                messages.push(serde_json::json!({
                    "role": "system",
                    "content": sys
                }));
            }

            messages.push(serde_json::json!({
                "role": "user",
                "content": prompt
            }));

            match client
                .post(format!("{}/api/chat", base_url))
                .json(&serde_json::json!({
                    "model": model,
                    "messages": messages,
                    "stream": true
                }))
                .send()
                .await
            {
                Ok(response) => {
                    let mut stream = response.bytes_stream();
                    use futures_util::StreamExt;

                    while let Some(chunk) = stream.next().await {
                        if let Ok(bytes) = chunk {
                            if let Ok(text) = String::from_utf8(bytes.to_vec()) {
                                for line in text.lines() {
                                    if let Ok(json) =
                                        serde_json::from_str::<serde_json::Value>(line)
                                    {
                                        if let Some(content) =
                                            json["message"]["content"].as_str()
                                        {
                                            let _ = tx.send(content.to_string()).await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Streaming error: {}", e);
                }
            }
        });

        Ok(rx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Only run when Ollama is available
    async fn test_ollama_provider() {
        let provider = OllamaProvider::new("qwen2.5:3b".to_string());

        let response = provider.generate("Say hello", None).await.unwrap();

        assert!(!response.content.is_empty());
    }
}
