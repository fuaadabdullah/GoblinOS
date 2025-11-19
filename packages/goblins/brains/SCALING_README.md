# Ollama LiteBrain Dynamic Performance Scaling

This implementation provides adaptive scaling for Ollama LiteBrains where incoming complexity dynamically adjusts resources.

## Overview

The scaling system consists of:

1. **Complexity Estimation**: Analyzes request content to determine complexity level (low/medium/high)
2. **Metrics Collection**: Prometheus metrics for monitoring request patterns and resource usage
3. **Horizontal Pod Autoscaling**: Kubernetes HPA that scales based on CPU, memory, and custom complexity metrics
4. **Scaling Controller**: Advanced controller that can adjust both replica count and resource limits

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LiteBrain     │    │   Metrics        │    │   HPA/K8s       │
│   Request       │───▶│   Collection     │───▶│   Autoscaling   │
│   Processing    │    │   (Prometheus)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Complexity      │    │ Custom Metrics   │    │ Scaling         │
│ Estimation      │    │ API              │    │ Controller      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components

### 1. Complexity Estimation

The system estimates complexity based on:
- **Word count**: Tasks with >300 words are considered high complexity
- **Keywords**: Architecture, design, refactor keywords indicate high complexity
- **Context size**: Larger context objects increase complexity
- **Historical patterns**: Learning from past request patterns

### 2. Metrics Collection

Prometheus metrics exposed:
- `litebrain_complexity_score`: Current complexity score (0-100)
- `litebrain_active_requests`: Number of active requests
- `litebrain_request_duration_seconds`: Request processing time
- `litebrain_requests_total`: Total requests by complexity and status

### 3. Kubernetes Scaling

The `ollama-scaling-k8s.yaml` provides:
- **Horizontal Pod Autoscaler** with multiple metrics:
  - CPU utilization (70% target)
  - Memory utilization (80% target)
  - Custom complexity score (50 average target)
- **Scaling policies** with stabilization windows
- **Resource limits** that adjust with complexity

### 4. Scaling Controller

Advanced controller that:
- Monitors complexity trends
- Applies scaling factors based on policy
- Adjusts both replica count and resource limits
- Provides graceful scaling with stabilization

## Configuration

### Scaling Policy

```json
{
  "complexityThresholds": {
    "low": 30,
    "medium": 50,
    "high": 80
  },
  "modelResourceWeights": {
    "qwen2.5:3b": 1.0,
    "deepseek-r1": 2.5,
    "codellama": 2.0
  },
  "scaleUpFactors": {
    "low": 1.2,
    "medium": 1.5,
    "high": 2.0
  }
}
```

### Environment Variables

- `LITEBRAIN_METRICS_PORT`: Metrics server port (default: 9090)
- `OLLAMA_HOST`: Ollama server endpoint
- `LITELLM_BASE_URL`: LiteLLM proxy URL

## Usage

### Deploying with Scaling

```bash
# Apply the scaling configuration
kubectl apply -f infra/deployments/ollama-scaling-k8s.yaml

# Check HPA status
kubectl get hpa -n goblinos-ai

# Monitor metrics
kubectl port-forward -n goblinos-ai svc/ollama-service 9090:9090
curl http://localhost:9090/metrics
```

### Testing Scaling

```bash
# Run the scaling test
cd GoblinOS/packages/goblins/brains
npm run build
node dist/test-scaling.js
```

## Scaling Behavior

### Scale Up Triggers
- Complexity score > 70 (high complexity tasks)
- CPU utilization > 70%
- Memory utilization > 80%
- Active request queue growing

### Scale Down Triggers
- Complexity score < 30 with decreasing trend
- Low resource utilization for extended periods
- Stabilization windows prevent thrashing

### Scaling Limits
- **Min replicas**: 1
- **Max replicas**: 10
- **Scale up stabilization**: 60 seconds
- **Scale down stabilization**: 300 seconds

## Monitoring

### Key Metrics to Monitor

1. **Complexity Trends**
   ```
   rate(litebrain_complexity_score[5m])
   ```

2. **Scaling Efficiency**
   ```
   kube_hpa_status_current_replicas{horizontalpodautoscaler="ollama-hpa"}
   ```

3. **Resource Usage**
   ```
   rate(litebrain_request_duration_seconds_sum[5m]) /
   rate(litebrain_request_duration_seconds_count[5m])
   ```

### Alerts

- Complexity score consistently > 80
- HPA at max replicas for > 10 minutes
- Request duration > 30 seconds average
- Error rate > 5%

## Performance Benefits

1. **Cost Optimization**: Scale down during low-complexity periods
2. **Performance**: Scale up for high-complexity workloads
3. **Reliability**: Prevent resource exhaustion during spikes
4. **Efficiency**: Match resources to actual workload requirements

## Troubleshooting

### Common Issues

1. **Not Scaling Up**
   - Check metrics collection: `kubectl logs -n goblinos-ai deployment/ollama-inference -c metrics-sidecar`
   - Verify HPA: `kubectl describe hpa ollama-hpa -n goblinos-ai`

2. **Frequent Scaling**
   - Increase stabilization windows in HPA spec
   - Adjust complexity thresholds in scaling policy

3. **High Latency**
   - Check resource limits vs requests
   - Monitor model loading times
   - Consider pre-warming models

### Debug Commands

```bash
# Check current scaling status
kubectl get hpa,pods -n goblinos-ai

# View metrics
kubectl exec -n goblinos-ai -it deployment/ollama-inference -- curl http://localhost:9090/metrics

# Check complexity trends
kubectl logs -n goblinos-ai -l app=ollama-inference --tail=100
```
