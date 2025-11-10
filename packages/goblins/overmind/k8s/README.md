# Overmind Kubernetes Deployment

Deploy Overmind AI orchestration system to Kubernetes.

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Ingress controller (nginx recommended)
- Metrics server (for HPA)
- Optional: cert-manager (for TLS)
- Optional: Jaeger operator (for tracing)

## Quick Start

> Tip: A helper deployment script is available at `../deploy.sh` (run from `packages/goblins/overmind/`). The script applies manifests in the recommended order and waits for deployments to be available. It still requires properly provisioned secrets (see below).

### 1. Create namespace

```bash
kubectl create namespace overmind
kubectl config set-context --current --namespace=overmind
```

### 2. Create secrets

**Option A: From literals**

```bash
kubectl create secret generic overmind-secrets \
  --from-literal=gemini_api_key=YOUR_GEMINI_KEY \
  --from-literal=deepseek_api_key=YOUR_DEEPSEEK_KEY \
  --from-literal=openai_api_key=YOUR_OPENAI_KEY
```

**Option B: From file**

```bash
cp k8s/secrets.yaml.example k8s/secrets.yaml
# Edit `k8s/secrets.yaml` with your actual keys. DO NOT commit this file to git.
# For production, prefer Sealed Secrets or External Secrets Operator instead of applying plaintext secrets.
kubectl apply -f k8s/secrets.yaml
```

### 3. Apply manifests

```bash
# Apply in order
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/bridge-deployment.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml  # Update domain first
```

**Or apply all at once:**

```bash
kubectl apply -f k8s/
```

### 4. Verify deployment

```bash
# Check pods
kubectl get pods -l app=overmind

# Check services
kubectl get svc -l app=overmind

# Check HPA
kubectl get hpa

# Check ingress
kubectl get ingress
```

### 5. Access services

**Via port-forward (local testing):**

```bash
# FastAPI backend
kubectl port-forward svc/overmind-api 8001:8001

# Node bridge
kubectl port-forward svc/overmind-bridge 3030:3030

# Access: http://localhost:8001/api/v1/chat
```

**Via Ingress (production):**

Update `k8s/ingress.yaml` with your domain, then access:
- API: https://overmind.example.com/api
- Dashboard: https://overmind.example.com/

## Configuration

### Resource Limits

Default resource requests/limits:

**API (FastAPI):**
- Requests: 256Mi memory, 100m CPU
- Limits: 512Mi memory, 500m CPU

**Bridge (Node.js):**
- Requests: 512Mi memory, 200m CPU
- Limits: 1Gi memory, 1000m CPU

Adjust in deployment files based on your workload.

### Autoscaling

HPA configured with:
- Min replicas: 2
- Max replicas: 10
- CPU target: 70%
- Memory target: 80%

Modify `k8s/hpa.yaml` for different scaling behavior.

### Ingress

Default configuration uses nginx ingress controller. For other ingress controllers:

```yaml
# Traefik
spec:
  ingressClassName: traefik

# AWS ALB
metadata:
  annotations:
    kubernetes.io/ingress.class: alb
```

## Observability

### Deploy Jaeger

**Option A: Jaeger Operator**

```bash
kubectl create namespace observability
kubectl create -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.60.0/jaeger-operator.yaml -n observability

# Create Jaeger instance
cat <<EOF | kubectl apply -f -
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: jaeger
  namespace: overmind
spec:
  strategy: allInOne
  ingress:
    enabled: true
  allInOne:
    image: jaegertracing/all-in-one:1.60
EOF
```

**Option B: Helm**

```bash
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm install jaeger jaegertracing/jaeger --namespace overmind
```

Access Jaeger UI:

```bash
kubectl port-forward svc/jaeger-query 16686:16686
# Open http://localhost:16686
```

### Metrics

Install Prometheus for metrics collection:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack --namespace overmind
```

## Secrets Management

### Using Sealed Secrets

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal your secret
kubeseal --format=yaml < k8s/secrets.yaml > k8s/sealed-secrets.yaml

# Apply sealed secret (safe to commit)
kubectl apply -f k8s/sealed-secrets.yaml
```

### Using External Secrets Operator

```bash
# Install ESO
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace

# Create SecretStore (example for AWS Secrets Manager)
cat <<EOF | kubectl apply -f -
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets
  namespace: overmind
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
EOF

# Create ExternalSecret
cat <<EOF | kubectl apply -f -
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: overmind-secrets
  namespace: overmind
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets
    kind: SecretStore
  target:
    name: overmind-secrets
  data:
  - secretKey: gemini_api_key
    remoteRef:
      key: overmind/gemini_api_key
  - secretKey: deepseek_api_key
    remoteRef:
      key: overmind/deepseek_api_key
EOF
```

## Troubleshooting

### Pods not starting

```bash
# Check pod events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Check if secrets exist
kubectl get secret overmind-secrets
```

### HPA not scaling

```bash
# Check metrics server
kubectl top nodes
kubectl top pods

# Install metrics server if missing
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Ingress not routing

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress events
kubectl describe ingress overmind-ingress

# Verify service endpoints
kubectl get endpoints
```

## Production Checklist

- [ ] Secrets stored securely (Sealed Secrets / External Secrets)
- [ ] TLS certificates configured (cert-manager)
- [ ] Resource limits set appropriately
- [ ] HPA configured and tested
- [ ] Health checks validated
- [ ] Monitoring and alerting enabled (Prometheus)
- [ ] Distributed tracing enabled (Jaeger)
- [ ] Log aggregation configured (ELK/Loki)
- [ ] Network policies defined
- [ ] Pod disruption budgets configured
- [ ] Backup and disaster recovery plan
- [ ] CI/CD pipeline for deployments

## Cleanup

```bash
# Delete all resources
kubectl delete -f k8s/

# Delete namespace
kubectl delete namespace overmind
```
