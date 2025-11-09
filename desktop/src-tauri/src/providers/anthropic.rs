use async_trait::async_trait;
use futures_util::StreamExt;
use serde_json::json;

use super::{GenerateResponse, ModelProvider, StreamChunk, TokenUsage};

pub struct AnthropicProvider {
    api_key: String,
    model: String,
    base_url: String,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            api_key,
            model: model.unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string()),
            base_url: "https://api.anthropic.com/v1".to_string(),
        }
    }
}

#[async_trait]
impl ModelProvider for AnthropicProvider {
    async fn generate(
        &self,
        prompt: &str,
        system: Option<&str>,
        model: Option<&str>,
    ) -> Result<GenerateResponse, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();

        let model_to_use = model.map(|m| m.to_string()).unwrap_or_else(|| self.model.clone());

        let mut payload = json!({
            "model": model_to_use,
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        });

        if let Some(sys) = system {
            payload["system"] = json!(sys);
        }

        let response = client
            .post(format!("{}/messages", self.base_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let content = response["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let tokens = Some(TokenUsage {
            prompt_tokens: response["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: response["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: (response["usage"]["input_tokens"].as_u64().unwrap_or(0)
                + response["usage"]["output_tokens"].as_u64().unwrap_or(0))
                as u32,
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

        let model_to_use = model.map(|m| m.to_string()).unwrap_or_else(|| self.model.clone());

        let mut payload = json!({
            "model": model_to_use,
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": prompt
            }],
            "stream": true
        });

        if let Some(sys) = system {
            payload["system"] = json!(sys);
        }

        let response = client
            .post(format!("{}/messages", self.base_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&payload)
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

                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                match json["type"].as_str() {
                                    Some("content_block_delta") => {
                                        if let Some(text) = json["delta"]["text"].as_str() {
                                            result.content.push_str(text);
                                        }
                                    }
                                    Some("message_stop") => {
                                        result.done = true;
                                    }
                                    Some("message_delta") => {
                                        if let Some(usage) = json["usage"].as_object() {
                                            let output_tokens =
                                                usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                            result.tokens = Some(TokenUsage {
                                                prompt_tokens: 0,
                                                completion_tokens: output_tokens,
                                                total_tokens: output_tokens,
                                            });
                                        }
                                    }
                                    _ => {}
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
        "anthropic"
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
