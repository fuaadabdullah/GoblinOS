
from smithy.automation.pipelines import PipelineGenerator, PipelineTemplateLibrary


def test_python_ci_pipeline(tmp_path):
    pipeline = PipelineTemplateLibrary.python_ci(branch="develop")
    generator = PipelineGenerator(workspace_root=tmp_path)
    out = generator.write_github_actions(pipeline, "python-ci.yml")
    content = out.read_text()
    assert "Python CI" in content
    assert "develop" in content
    assert "actions/checkout@v4" in content


def test_release_pipeline_envs(tmp_path):
    pipeline = PipelineTemplateLibrary.release_pipeline(["staging", "production"])
    generator = PipelineGenerator(workspace_root=tmp_path)
    out = generator.write_github_actions(pipeline, "release.yml")
    content = out.read_text()
    assert "deploy-staging" in content
    assert "deploy-production" in content
