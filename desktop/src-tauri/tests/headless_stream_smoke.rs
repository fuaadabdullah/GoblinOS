use goblinos_desktop_lib::commands::GoblinRuntime;
use goblinos_desktop_lib::commands::{store_api_key, get_api_key, clear_api_key};
use goblinos_desktop_lib::providers::{ModelProvider, StreamChunk};
use futures_util::{stream, StreamExt};

#[tokio::test]
async fn headless_smoke_end_to_end() {
    // Initialize runtime with in-memory DB and repo config
    let runtime = GoblinRuntime::new(":memory:", "../../goblins.yaml")
        .await
        .expect("runtime init");

    // Providers list should include at least local ollama
    let providers = runtime.list_providers();
    assert!(providers.contains(&"ollama".to_string()));

    // Keyring store/get/clear using the public command helpers
    let provider_name = "test-smoke-key".to_string();
    let test_key = "sk-test-123".to_string();

    // store
    store_api_key(provider_name.clone(), test_key.clone())
        .await
        .expect("store api key");

    // get
    let got = get_api_key(provider_name.clone())
        .await
        .expect("get api key");
    assert_eq!(got, Some(test_key.clone()));

    // clear
    clear_api_key(provider_name.clone())
        .await
        .expect("clear api key");

    // After clear some platforms may return an Err describing no entry; accept either None or a NotFound-like Err.
    let got2_res = get_api_key(provider_name.clone()).await;
    match got2_res {
        Ok(None) => {}
        Ok(Some(s)) => panic!("expected None after clear, found {}", s),
        Err(e) => {
            let el = e.to_lowercase();
            if el.contains("no matching") || el.contains("no entry") || el.contains("no such") {
                // treat as cleared
            } else {
                panic!("unexpected error from get_api_key after clear: {}", e);
            }
        }
    }

    // Mock provider streaming test: ensure streams yield chunks
    struct MockProvider;

    #[async_trait::async_trait]
    impl ModelProvider for MockProvider {
        async fn generate(&self, _prompt: &str, _system: Option<&str>, _model: Option<&str>) -> Result<goblinos_desktop_lib::providers::GenerateResponse, Box<dyn std::error::Error + Send + Sync>> {
            Ok(goblinos_desktop_lib::providers::GenerateResponse { content: "ok".to_string(), model: "m".to_string(), tokens: None })
        }

        async fn generate_stream(&self, prompt: &str, _system: Option<&str>, _model: Option<&str>) -> Result<Box<dyn futures_util::Stream<Item = Result<StreamChunk, Box<dyn std::error::Error + Send + Sync>>> + Send + Unpin>, Box<dyn std::error::Error + Send + Sync>> {
            let chunks = vec![
                Ok(StreamChunk { content: format!("{}-p1", prompt), done: false, tokens: None }),
                Ok(StreamChunk { content: format!("{}-p2", prompt), done: true, tokens: None }),
            ];

            Ok(Box::new(Box::pin(stream::iter(chunks))))
        }

        fn provider_name(&self) -> &str { "mock" }
        fn model_name(&self) -> &str { "mock-model" }
    }

    let p = MockProvider;
    let mut s = p.generate_stream("hello", None, None).await.expect("stream ok");
    let mut seen = Vec::new();
    while let Some(item) = s.next().await {
        let c = item.expect("chunk ok");
        seen.push(c.content);
    }

    assert!(!seen.is_empty());
}
