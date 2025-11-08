from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


@dataclass
class PipelineStep:
    name: Optional[str] = None
    run: Optional[str] = None
    uses: Optional[str] = None
    shell: Optional[str] = None
    env: Dict[str, str] = field(default_factory=dict)
    with_args: Dict[str, Any] = field(default_factory=dict)

    def to_actions(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        if self.name:
            data["name"] = self.name
        if self.uses:
            data["uses"] = self.uses
        if self.run:
            data["run"] = self.run
        if self.shell:
            data["shell"] = self.shell
        if self.env:
            data["env"] = self.env
        if self.with_args:
            data["with"] = self.with_args
        return data


@dataclass
class PipelineJob:
    name: str
    runs_on: str = "ubuntu-latest"
    steps: List[PipelineStep] = field(default_factory=list)
    needs: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    strategy: Optional[Dict[str, Any]] = None

    def to_actions(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "runs-on": self.runs_on,
            "steps": [step.to_actions() for step in self.steps],
        }
        if self.needs:
            data["needs"] = self.needs
        if self.env:
            data["env"] = self.env
        if self.strategy:
            data["strategy"] = self.strategy
        return data


@dataclass
class Pipeline:
    name: str
    triggers: Dict[str, Any]
    jobs: List[PipelineJob]

    def to_github_actions(self) -> str:
        data = {
            "name": self.name,
            "on": self.triggers,
            "jobs": {job.name: job.to_actions() for job in self.jobs},
        }
        return yaml.safe_dump(data, sort_keys=False)


class PipelineTemplateLibrary:
    """Curated set of CI/CD templates."""

    @staticmethod
    def python_ci(branch: str = "main") -> Pipeline:
        steps = [
            PipelineStep(uses="actions/checkout@v4"),
            PipelineStep(uses="actions/setup-python@v5", with_args={"python-version": "3.11"}),
            PipelineStep(name="Install", run="python -m pip install --upgrade pip\npip install -r requirements.txt"),
            PipelineStep(name="Lint", run="ruff check .\nruff format --check ."),
            PipelineStep(name="Tests", run="pytest -q"),
            PipelineStep(name="Build", run="python -m build"),
        ]
        job = PipelineJob(name="build", steps=steps)
        return Pipeline(
            name="Python CI",
            triggers={"push": {"branches": [branch]}, "pull_request": {}},
            jobs=[job],
        )

    @staticmethod
    def node_ci(branch: str = "main") -> Pipeline:
        steps = [
            PipelineStep(uses="actions/checkout@v4"),
            PipelineStep(uses="actions/setup-node@v4", with_args={"node-version": "20", "cache": "pnpm"}),
            PipelineStep(name="Install", run="pnpm install"),
            PipelineStep(name="Lint", run="pnpm lint"),
            PipelineStep(name="Tests", run="pnpm test -- --run"),
            PipelineStep(name="Build", run="pnpm build"),
        ]
        job = PipelineJob(name="build", steps=steps)
        return Pipeline(
            name="Node CI",
            triggers={"push": {"branches": [branch]}, "pull_request": {}},
            jobs=[job],
        )

    @staticmethod
    def release_pipeline(envs: List[str]) -> Pipeline:
        jobs: List[PipelineJob] = []
        previous_job: Optional[str] = None
        for env in envs:
            job_name = f"deploy-{env}"
            job = PipelineJob(
                name=job_name,
                steps=[
                    PipelineStep(uses="actions/checkout@v4"),
                    PipelineStep(
                        name="Deploy",
                        run=f"./scripts/deploy.sh {env}",
                        env={"ENVIRONMENT": env.upper()},
                    ),
                ],
                needs=[previous_job] if previous_job else [],
            )
            jobs.append(job)
            previous_job = job_name
        return Pipeline(
            name="Release",
            triggers={"workflow_dispatch": {}, "push": {"tags": ["v*"]}},
            jobs=jobs,
        )


class PipelineGenerator:
    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root

    def write_github_actions(self, pipeline: Pipeline, filename: str) -> Path:
        output_dir = self.workspace_root / ".github" / "workflows"
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / filename
        path.write_text(pipeline.to_github_actions())
        return path
