use async_trait::async_trait;
use futures_util::StreamExt;
use serde_json::json;

use super::{GenerateResponse, ModelProvider, StreamChunk, TokenUsage};

pub struct GeminiProvider {
    api_key: String,
    model: String,
    base_url: String,
}

impl GeminiProvider {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            api_key,
            model: model.unwrap_or_else(|| "gemini-1.5-pro-latest".to_string()),
            base_url: "https://generativelanguage.googleapis.com/v1beta".to_string(),
        }
    }
}

#[async_trait]
impl ModelProvider for GeminiProvider {
    async fn generate(
        &self,
        prompt: &str,
        system: Option<&str>,
    ) -> Result<GenerateResponse, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();

        let mut contents = vec![];

        if let Some(sys) = system {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": format!("System: {}\n\nUser: {}", sys, prompt)}]
            }));
        } else {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": prompt}]
            }));
        }

        let response = client
            .post(format!(
                "{}/models/{}:generateContent?key={}",
                self.base_url, self.model, self.api_key
            ))
            .header("Content-Type", "application/json")
            .json(&json!({
                "contents": contents,
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let content = response["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

        // Gemini token counts
        let prompt_token_count = response["usageMetadata"]["promptTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;
        let candidates_token_count = response["usageMetadata"]["candidatesTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;
        let total_token_count = response["usageMetadata"]["totalTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;

        let tokens = Some(TokenUsage {
            prompt_tokens: prompt_token_count,
            completion_tokens: candidates_token_count,
            total_tokens: total_token_count,
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

        let mut contents = vec![];

        if let Some(sys) = system {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": format!("System: {}\n\nUser: {}", sys, prompt)}]
            }));
        } else {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": prompt}]
            }));
        }

        let response = client
            .post(format!(
                "{}/models/{}:streamGenerateContent?key={}",
                self.base_url, self.model, self.api_key
            ))
            .header("Content-Type", "application/json")
            .json(&json!({
                "contents": contents,
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
                    let mut result = StreamChunk {
                        content: String::new(),
                        done: false,
                        tokens: None,
                    };

                    // Gemini streaming returns JSON objects separated by newlines
                    for line in text.lines() {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                            if let Some(candidates) = json["candidates"].as_array() {
                                if let Some(candidate) = candidates.first() {
                                    if let Some(content) = candidate["content"]["parts"][0]["text"].as_str() {
                                        result.content.push_str(content);
                                    }

                                    if let Some(finish_reason) = candidate["finishReason"].as_str() {
                                        if finish_reason != "STOP" {
                                            result.done = false;
                                        } else {
                                            result.done = true;
                                        }
                                    }
                                }
                            }

                            // Extract token usage if available
                            if let Some(usage) = json["usageMetadata"].as_object() {
                                let prompt_tokens = usage.get("promptTokenCount")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0) as u32;
                                let completion_tokens = usage.get("candidatesTokenCount")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0) as u32;

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
        "gemini"
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
