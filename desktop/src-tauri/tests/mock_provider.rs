use futures_util::stream::{self, StreamExt};

#[tokio::test]
async fn mock_generate_and_stream_model_override() {
    struct MockProvider {
        default_model: String,
    }

    impl MockProvider {
        async fn generate(&self, prompt: &str, _system: Option<&str>, model: Option<&str>) -> Result<String, Box<dyn std::error::Error>> {
            let model_used = model.unwrap_or(&self.default_model);
            Ok(format!("model:{}|resp:{}", model_used, prompt))
        }

        async fn generate_stream(&self, prompt: &str, _system: Option<&str>, model: Option<&str>) -> impl futures_util::Stream<Item = Result<String, Box<dyn std::error::Error>>> {
            let model_used = model.unwrap_or(&self.default_model).to_string();
            let chunks = vec![
                Ok(format!("{}|model:{}|p1", prompt, model_used)),
                Ok(format!("{}|model:{}|p2", prompt, model_used)),
            ];
            stream::iter(chunks)
        }
    }

    let p = MockProvider { default_model: "default-model".to_string() };

    // test generate override
    let r = p.generate("hello", None, Some("override-model")).await.unwrap();
    assert!(r.contains("model:override-model"));

    let r2 = p.generate("hello", None, None).await.unwrap();
    assert!(r2.contains("model:default-model"));

    // test streaming override
    let mut s = p.generate_stream("ping", None, Some("stream-model")).await;
    let mut collected = Vec::new();
    while let Some(item) = s.next().await {
        let v = item.unwrap();
        collected.push(v);
    }
    assert!(collected.iter().all(|c| c.contains("model:stream-model")));
}
