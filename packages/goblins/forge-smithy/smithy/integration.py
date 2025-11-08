"""Integration capabilities for Smithy - CI/CD and container support."""

import subprocess
import json
import pathlib
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

ROOT = pathlib.Path(__file__).resolve().parents[1]

@dataclass
class PipelineConfig:
    """Configuration for CI/CD pipeline integration."""
    name: str
    platform: str  # github, gitlab, azure, jenkins
    triggers: List[str]
    environments: List[str]
    checks: List[str]
    notifications: Dict[str, Any]

@dataclass
class ContainerConfig:
    """Configuration for container integration."""
    base_image: str
    python_version: str
    system_packages: List[str]
    build_stages: List[str]
    ports: List[int]
    volumes: List[str]
    environment_variables: Dict[str, str]

@dataclass
class IntegrationResult:
    """Result of an integration operation."""
    success: bool
    operation: str
    output: str
    artifacts: List[str]
    errors: List[str]

class IntegrationManager:
    """CI/CD and container integration management."""

    def __init__(self):
        self.root = ROOT
        self.integrations_dir = self.root / ".smithy" / "integrations"
        self.integrations_dir.mkdir(parents=True, exist_ok=True)

    def create_github_actions_workflow(self, name: str = "smithy-ci",
                                     python_versions: Optional[List[str]] = None,
                                     os_matrix: Optional[List[str]] = None) -> bool:
        """Create a GitHub Actions workflow for Smithy.

        Args:
            name: Workflow name
            python_versions: Python versions to test
            os_matrix: Operating systems to test

        Returns:
            Success status
        """
        if python_versions is None:
            python_versions = ["3.11", "3.12"]
        if os_matrix is None:
            os_matrix = ["ubuntu-latest"]

        workflow_content = f"""name: {name}

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ${{{"{{ matrix.os }}"}}}

    strategy:
      matrix:
        os: {os_matrix}
        python-version: {python_versions}

    steps:
    - uses: actions/checkout@v4

    - name: Set up Python ${{{"{{ matrix.python-version }}"}}}
      uses: actions/setup-python@v4
      with:
        python-version: ${{{"{{ matrix.python-version }}"}}}

    - name: Install uv
      run: |
        curl -LsSf https://astral.sh/uv/install.sh | sh
        echo "$HOME/.cargo/bin" >> $GITHUB_PATH

    - name: Cache uv dependencies
      uses: actions/cache@v3
      with:
        path: ~/.cache/uv
        key: uv-${{{"{{ matrix.os }}"}}}-${{{"{{ matrix.python-version }}"}}}-${{{"{{ hashFiles('**/pyproject.toml', '**/requirements*.txt') }}"}}}
        restore-keys: |
          uv-${{{"{{ matrix.os }}"}}}-${{{"{{ matrix.python-version }}"}}}

    - name: Install dependencies
      run: uv sync --dev

    - name: Run linting
      run: uv run ruff check .

    - name: Run type checking
      run: uv run mypy .

    - name: Run tests
      run: uv run pytest --cov=smithy --cov-report=xml

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-umbrella
        fail_ci_if_error: false

  security:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install uv
      run: |
        curl -LsSf https://astral.sh/uv/install.sh | sh
        echo "$HOME/.cargo/bin" >> $GITHUB_PATH

    - name: Install dependencies
      run: uv sync --dev

    - name: Run security audit
      run: uv run pip-audit

    - name: Check for secrets
      uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{{"{{ secrets.GITHUB_TOKEN }}"}}}

  container:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Build container
      uses: docker/build-push-action@v5
      with:
        context: .
        push: false
        tags: smithy:test
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Test container
      run: |
        docker run --rm smithy:test smithy --help
"""

        workflows_dir = self.root / ".github" / "workflows"
        workflows_dir.mkdir(parents=True, exist_ok=True)

        workflow_file = workflows_dir / f"{name}.yml"
        workflow_file.write_text(workflow_content)

        return True

    def create_dockerfile(self, config: ContainerConfig) -> bool:
        """Create a Dockerfile for Smithy.

        Args:
            config: Container configuration

        Returns:
            Success status
        """
        dockerfile_content = f"""FROM {config.base_image}

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    {" ".join(config.system_packages)} \\
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Set up Python
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Create application directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml requirements*.txt ./

# Install Python dependencies
RUN uv sync --frozen --no-install-project --no-dev

# Copy source code
COPY . .

# Install project in editable mode
RUN uv sync --frozen --no-dev

# Create non-root user
RUN useradd --create-home --shell /bin/bash smithy
USER smithy

# Expose ports
{" ".join(f"EXPOSE {port}" for port in config.ports)}

# Set environment variables
{chr(10).join(f"ENV {k}={v}" for k, v in config.environment_variables.items())}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \\
  CMD python -c "import smithy; print('Smithy is healthy')" || exit 1

# Default command
CMD ["python", "-m", "smithy"]
"""

        dockerfile_path = self.root / "Dockerfile"
        dockerfile_path.write_text(dockerfile_content)

        return True

    def create_docker_compose(self, services: Dict[str, Any]) -> bool:
        """Create a docker-compose.yml file.

        Args:
            services: Service configurations

        Returns:
            Success status
        """
        compose_config = {
            "version": "3.8",
            "services": services,
            "networks": {
                "smithy-network": {
                    "driver": "bridge"
                }
            }
        }

        compose_file = self.root / "docker-compose.yml"
        compose_file.write_text(json.dumps(compose_config, indent=2))

        return True

    def create_helm_chart(self, name: str, version: str = "0.1.0") -> bool:
        """Create a Helm chart for Kubernetes deployment.

        Args:
            name: Chart name
            version: Chart version

        Returns:
            Success status
        """
        chart_dir = self.root / "charts" / name
        chart_dir.mkdir(parents=True, exist_ok=True)

        # Create Chart.yaml
        chart_yaml = f"""apiVersion: v2
name: {name}
description: Smithy - Advanced Python Environment Management
type: application
version: {version}
appVersion: "1.0.0"
"""

        (chart_dir / "Chart.yaml").write_text(chart_yaml)

        # Create values.yaml
        values_yaml = """replicaCount: 1

image:
  repository: smithy
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8000

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 100m
    memory: 256Mi

nodeSelector: {{}}

tolerations: []

affinity: {{}}
"""

        (chart_dir / "values.yaml").write_text(values_yaml)

        # Create templates directory
        templates_dir = chart_dir / "templates"
        templates_dir.mkdir(exist_ok=True)

        # Create deployment template
        deployment_yaml = """apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "smithy.fullname" . }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "smithy.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "smithy.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: smithy
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
"""

        (templates_dir / "deployment.yaml").write_text(deployment_yaml)

        # Create service template
        service_yaml = """apiVersion: v1
kind: Service
metadata:
  name: {{ include "smithy.fullname" . }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    {{- include "smithy.selectorLabels" . | nindent 4 }}
"""

        (templates_dir / "service.yaml").write_text(service_yaml)

        # Create _helpers.tpl
        helpers_tpl = """{{/*
Expand the name of the chart.
*/}}
{{- define "smithy.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "smithy.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "smithy.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "smithy.labels" -}}
helm.sh/chart: {{ include "smithy.chart" . }}
{{ include "smithy.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "smithy.selectorLabels" -}}
app.kubernetes.io/name: {{ include "smithy.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
"""

        (templates_dir / "_helpers.tpl").write_text(helpers_tpl)

        return True

    def create_terraform_config(self, environment: str) -> bool:
        """Create Terraform configuration for infrastructure.

        Args:
            environment: Target environment (dev, staging, prod)

        Returns:
            Success status
        """
        tf_dir = self.root / "terraform" / environment
        tf_dir.mkdir(parents=True, exist_ok=True)

        # Create main.tf
        main_tf = f"""terraform {{
  required_providers {{
    azurerm = {{
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }}
  }}
}}

provider "azurerm" {{
  features {{}}
}}

# Resource group
resource "azurerm_resource_group" "smithy" {{
  name     = "smithy-{environment}"
  location = "East US"
}}

# Container registry
resource "azurerm_container_registry" "smithy" {{
  name                = "smithy{environment}registry"
  resource_group_name = azurerm_resource_group.smithy.name
  location            = azurerm_resource_group.smithy.location
  sku                 = "Basic"
  admin_enabled       = true
}}

# Kubernetes cluster
resource "azurerm_kubernetes_cluster" "smithy" {{
  name                = "smithy-{environment}-aks"
  location            = azurerm_resource_group.smithy.location
  resource_group_name = azurerm_resource_group.smithy.name
  dns_prefix          = "smithy{environment}"

  default_node_pool {{
    name       = "default"
    node_count = 1
    vm_size    = "Standard_DS2_v2"
  }}

  identity {{
    type = "SystemAssigned"
  }}
}}

# Storage account for state
resource "azurerm_storage_account" "smithy" {{
  name                     = "smithy{environment}storage"
  resource_group_name      = azurerm_resource_group.smithy.name
  location                 = azurerm_resource_group.smithy.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}}
"""

        (tf_dir / "main.tf").write_text(main_tf)

        # Create variables.tf
        variables_tf = """variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}
"""

        (tf_dir / "variables.tf").write_text(variables_tf)

        # Create outputs.tf
        outputs_tf = """output "resource_group_name" {
  value = azurerm_resource_group.smithy.name
}

output "acr_login_server" {
  value = azurerm_container_registry.smithy.login_server
}

output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.smithy.name
}

output "storage_account_name" {
  value = azurerm_storage_account.smithy.name
}
"""

        (tf_dir / "outputs.tf").write_text(outputs_tf)

        return True

    def run_integration_test(self, integration_type: str) -> IntegrationResult:
        """Run integration tests for specified type.

        Args:
            integration_type: Type of integration to test

        Returns:
            Integration test result
        """
        try:
            if integration_type == "docker":
                # Test Docker build
                result = subprocess.run(
                    ["docker", "build", "-t", "smithy:test", "."],
                    capture_output=True,
                    text=True,
                    cwd=self.root
                )

                success = result.returncode == 0
                output = result.stdout + result.stderr
                artifacts = ["Dockerfile"] if success else []
                errors = [result.stderr] if not success else []

            elif integration_type == "compose":
                # Test docker-compose
                result = subprocess.run(
                    ["docker-compose", "config"],
                    capture_output=True,
                    text=True,
                    cwd=self.root
                )

                success = result.returncode == 0
                output = result.stdout + result.stderr
                artifacts = ["docker-compose.yml"] if success else []
                errors = [result.stderr] if not success else []

            elif integration_type == "kubernetes":
                # Test Kubernetes manifests
                result = subprocess.run(
                    ["kubectl", "apply", "--dry-run=client", "-f", "charts/"],
                    capture_output=True,
                    text=True,
                    cwd=self.root
                )

                success = result.returncode == 0
                output = result.stdout + result.stderr
                artifacts = ["charts/"] if success else []
                errors = [result.stderr] if not success else []

            else:
                return IntegrationResult(
                    success=False,
                    operation=f"test_{integration_type}",
                    output="",
                    artifacts=[],
                    errors=[f"Unknown integration type: {integration_type}"]
                )

            return IntegrationResult(
                success=success,
                operation=f"test_{integration_type}",
                output=output,
                artifacts=artifacts,
                errors=errors
            )

        except subprocess.CalledProcessError as e:
            return IntegrationResult(
                success=False,
                operation=f"test_{integration_type}",
                output=str(e),
                artifacts=[],
                errors=[str(e)]
            )

def create_github_workflow(name: str = "smithy-ci",
                          python_versions: Optional[List[str]] = None) -> bool:
    """Convenience function to create GitHub Actions workflow.

    Args:
        name: Workflow name
        python_versions: Python versions to test

    Returns:
        Success status
    """
    manager = IntegrationManager()
    return manager.create_github_actions_workflow(name, python_versions)

def create_container_config(base_image: str = "python:3.11-slim",
                           python_version: str = "3.11") -> ContainerConfig:
    """Create a default container configuration.

    Args:
        base_image: Base Docker image
        python_version: Python version

    Returns:
        Container configuration
    """
    return ContainerConfig(
        base_image=base_image,
        python_version=python_version,
        system_packages=["git", "curl", "build-essential"],
        build_stages=["deps", "runtime"],
        ports=[8000],
        volumes=["./data:/app/data"],
        environment_variables={
            "PYTHONUNBUFFERED": "1",
            "ENVIRONMENT": "production"
        }
    )

def create_helm_chart(name: str, version: str = "0.1.0") -> bool:
    """Convenience function to create Helm chart.

    Args:
        name: Chart name
        version: Chart version

    Returns:
        Success status
    """
    manager = IntegrationManager()
    return manager.create_helm_chart(name, version)

def test_integration(integration_type: str) -> IntegrationResult:
    """Convenience function to test integration.

    Args:
        integration_type: Type of integration to test

    Returns:
        Integration test result
    """
    manager = IntegrationManager()
    return manager.run_integration_test(integration_type)
