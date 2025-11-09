use async_trait::async_trait;
use futures_util::StreamExt;
use serde_json::json;

use super::{GenerateResponse, ModelProvider, StreamChunk, TokenUsage};

pub struct OpenAIProvider {
    api_key: String,
    model: String,
    base_url: String,
}

impl OpenAIProvider {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            api_key,
            model: model.unwrap_or_else(|| "gpt-4-turbo-preview".to_string()),
            base_url: "https://api.openai.com/v1".to_string(),
        }
    }
}

#[async_trait]
impl ModelProvider for OpenAIProvider {
    async fn generate(
        &self,
        prompt: &str,
        system: Option<&str>,
        model: Option<&str>,
    ) -> Result<GenerateResponse, Box<dyn std::error::Error + Send + Sync>> {
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

        let model_to_use = model.map(|m| m.to_string()).unwrap_or_else(|| self.model.clone());

        let response = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&json!({
                "model": model_to_use,
                "messages": messages,
                "stream": false
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let content = response["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let tokens = Some(TokenUsage {
            prompt_tokens: response["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: response["usage"]["completion_tokens"]
                .as_u64()
                .unwrap_or(0) as u32,
            total_tokens: response["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        });

        Ok(GenerateResponse {
            content,
            model: model_to_use,
            tokens,
        })
    }

    async fn generate_stream(
        &self,
        prompt: &str,
        system: Option<&str>,
        model: Option<&str>,
    ) -> Result<
        Box<
            dyn futures_util::Stream<Item = Result<StreamChunk, Box<dyn std::error::Error + Send + Sync>>>
                + Send
                + Unpin,
        >,
        Box<dyn std::error::Error + Send + Sync>,
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

        let model_to_use = model.map(|m| m.to_string()).unwrap_or_else(|| self.model.clone());

        let response = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&json!({
                "model": model_to_use,
                "messages": messages,
                "stream": true
            }))
            .send()
            .await?;

        let stream = response.bytes_stream().map(|chunk_result| {
            chunk_result
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
                .and_then(|bytes| {
                    String::from_utf8(bytes.to_vec())
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
                })
                .and_then(|text| {
                    let mut result = StreamChunk {
                        content: String::new(),
                        done: false,
                        tokens: None,
                    };

                    for line in text.lines() {
                        if line.starts_with("data: ") {
                            let data = &line[6..];

                            if data == "[DONE]" {
                                result.done = true;
                                break;
                            }

                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                                    result.content.push_str(delta);
                                }

                                if let Some(finish_reason) = json["choices"][0]["finish_reason"].as_str() {
                                    if finish_reason == "stop" {
                                        result.done = true;
                                    }
                                }
                            }
                        }
                    }

                    Ok(result)
                })
        });

        Ok(Box::new(Box::pin(stream)))
    }

    fn provider_name(&self) -> &str {
        "openai"
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
