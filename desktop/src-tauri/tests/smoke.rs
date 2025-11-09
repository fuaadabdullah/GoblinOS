use goblinos_desktop_lib::commands::GoblinRuntime;

#[tokio::test]
async fn runtime_smoke_providers() {
    // Use in-memory DB and repository Goblins config (relative path)
    let runtime = GoblinRuntime::new(":memory:", "../../goblins.yaml").await.expect("runtime init");

    let providers = runtime.list_providers();

    // At minimum, local Ollama provider should be present
    assert!(providers.contains(&"ollama".to_string()));
}
