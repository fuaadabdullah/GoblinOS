import json
from pathlib import Path

from smithy.automation.plugins import PluginManager


def test_builtin_language_plugin():
    project_root = Path(__file__).resolve().parent
    manager = PluginManager(project_root=project_root)
    records = manager.list_plugins()
    assert "language-python" in records

    manager.enable("language-python")
    available = manager.extension_registry.available()
    assert "language.detect" in available
    manager.disable("language-python")


def test_docker_daemon_plugin(tmp_path):
    project_root = Path(__file__).resolve().parent
    manager = PluginManager(project_root=project_root)
    manager.enable("tooling-docker-daemon")

    extensions = manager.extension_registry.available()
    assert "docker.daemon.status" in extensions

    generate = next(iter(manager.extension_registry.get("docker.daemon.config.generate")))
    config = generate(metrics_addr="0.0.0.0:9323", insecure_registries=["registry.local:5000"])
    assert config["metrics-addr"] == "0.0.0.0:9323"
    assert "insecure-registries" in config

    audit = next(iter(manager.extension_registry.get("docker.daemon.config.audit")))
    config_path = tmp_path / "daemon.json"
    config_path.write_text(json.dumps({"debug": True, "live-restore": False}))
    result = audit(path=str(config_path))
    assert result["status"] == "warnings"
    assert result["findings"], "Audit should flag debug/live-restore settings"

    manager.disable("tooling-docker-daemon")


def test_typescript_plugin(tmp_path):
    project_root = Path(__file__).resolve().parent
    manager = PluginManager(project_root=project_root)
    manager.enable("language-typescript")

    detect = next(iter(manager.extension_registry.get("language.detect")))
    detection = detect(project_root=str(tmp_path))
    assert detection["language"] in {"typescript", "unknown"}

    tooling = next(iter(manager.extension_registry.get("language.tooling")))
    tools = tooling()
    assert "pnpm biome format" in tools["formatters"][0]

    manager.disable("language-typescript")


def test_aws_guardrails_plugin():
    project_root = Path(__file__).resolve().parent
    manager = PluginManager(project_root=project_root)
    manager.enable("cloud-aws-guardrails")

    evaluate = next(iter(manager.extension_registry.get("cloud.aws.guardrails.evaluate")))
    result = evaluate({"aws_config_enabled": False, "guardduty_regions": ["us-east-1"]})
    assert result["status"] == "warnings"
    assert result["results"]

    summary = next(iter(manager.extension_registry.get("cloud.aws.guardrails.summary")))
    text = summary({"aws_config_enabled": False})
    assert "AWS Guardrails" in text

    manager.disable("cloud-aws-guardrails")
