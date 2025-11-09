use goblinos_desktop_lib::commands::GoblinRuntime;
use goblinos_desktop_lib::providers::{ModelProvider, StreamChunk, GenerateResponse};
use futures_util::{stream, StreamExt};

struct MockProvider2;

#[async_trait::async_trait]
impl ModelProvider for MockProvider2 {
    async fn generate(&self, prompt: &str, _system: Option<&str>, model: Option<&str>) -> Result<GenerateResponse, Box<dyn std::error::Error + Send + Sync>> {
        let m = model.map(|s| s.to_string()).unwrap_or_else(|| "mock-model".to_string());
        Ok(GenerateResponse { content: format!("resp:{}", prompt), model: m, tokens: None })
    }

    async fn generate_stream(&self, prompt: &str, _system: Option<&str>, _model: Option<&str>) -> Result<Box<dyn futures_util::Stream<Item = Result<StreamChunk, Box<dyn std::error::Error + Send + Sync>>> + Send + Unpin>, Box<dyn std::error::Error + Send + Sync>> {
        let chunks = vec![
            Ok(StreamChunk { content: format!("{}-a", prompt), done: false, tokens: None }),
            Ok(StreamChunk { content: format!("{}-b", prompt), done: true, tokens: None }),
        ];
        Ok(Box::new(Box::pin(stream::iter(chunks))))
    }

    fn provider_name(&self) -> &str { "mock2" }
    fn model_name(&self) -> &str { "mock-model" }
}

#[tokio::test]
async fn provider_model_and_streaming_e2e() {
    let mut runtime = GoblinRuntime::new(":memory:", "../../goblins.yaml").await.expect("init");

    // Register mock provider dynamically
    runtime.register_provider("mock2", Box::new(MockProvider2));

    // Execute regular task with provider+model override
    let res = runtime.execute_task("test-goblin", "hello", Some("mock2"), Some("custom-model")).await.expect("exec");
    assert_eq!(res.model.unwrap_or_default(), "mock-model");

    // Execute streaming through runtime helper and ensure chunks are collected
    let collected = runtime.generate_stream_collect("mock2", "streamme", None).await.expect("collect");
    assert!(collected.contains("streamme-a") || collected.contains("streamme-b"));
}
