use async_trait::async_trait;
use futures_util::StreamExt;
use serde_json::json;

use super::{GenerateResponse, ModelProvider, StreamChunk, TokenUsage};

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
        system: Option<&str>,
    ) -> Result<GenerateResponse, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let mut messages = vec![];

        if let Some(sys) = system {
            messages.push(json!({
                "role": "system",
                "content": sys
            }));
        }

        messages.push(json!({
            "role": "user",
            "content": prompt
        }));

        let response = client
            .post(format!("{}/api/chat", self.base_url))
            .json(&json!({
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

        // Ollama returns token counts in eval_count fields
        let prompt_eval_count = response["prompt_eval_count"].as_u64().unwrap_or(0) as u32;
        let eval_count = response["eval_count"].as_u64().unwrap_or(0) as u32;

        let tokens = Some(TokenUsage {
            prompt_tokens: prompt_eval_count,
            completion_tokens: eval_count,
            total_tokens: prompt_eval_count + eval_count,
        });

        Ok(GenerateResponse {
            content,
            model: self.model.clone(),
            tokens,
        })
    }

    async fn generate_stream(
        &self,
        prompt: &str,
        system: Option<&str>,
    ) -> Result<
        Box<
            dyn futures_util::Stream<Item = Result<StreamChunk, Box<dyn std::error::Error>>>
                + Send
                + Unpin,
        >,
        Box<dyn std::error::Error>,
    > {
        let client = reqwest::Client::new();
        let mut messages = vec![];

        if let Some(sys) = system {
            messages.push(json!({
                "role": "system",
                "content": sys
            }));
        }

        messages.push(json!({
            "role": "user",
            "content": prompt
        }));

        let response = client
            .post(format!("{}/api/chat", self.base_url))
            .json(&json!({
                "model": self.model,
                "messages": messages,
                "stream": true
            }))
            .send()
            .await?;

        let stream = response.bytes_stream().map(|chunk_result| {
            chunk_result
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)
                .and_then(|bytes| {
                    String::from_utf8(bytes.to_vec())
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)
                })
                .and_then(|text| {
                    // Parse each line as JSON
                    let mut result = StreamChunk {
                        content: String::new(),
                        done: false,
                        tokens: None,
                    };

                    for line in text.lines() {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                            if let Some(content) = json["message"]["content"].as_str() {
                                result.content.push_str(content);
                            }

                            if json["done"].as_bool().unwrap_or(false) {
                                result.done = true;

                                // Extract token counts from final message
                                let prompt_tokens =
                                    json["prompt_eval_count"].as_u64().unwrap_or(0) as u32;
                                let completion_tokens =
                                    json["eval_count"].as_u64().unwrap_or(0) as u32;

                                result.tokens = Some(TokenUsage {
                                    prompt_tokens,
                                    completion_tokens,
                                    total_tokens: prompt_tokens + completion_tokens,
                                });
                            }
                        }
                    }

                    Ok(result)
                })
        });

        Ok(Box::new(Box::pin(stream)))
    }

    fn provider_name(&self) -> &str {
        "ollama"
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
