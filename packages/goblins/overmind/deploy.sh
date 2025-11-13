#!/bin/bash

# Overmind Production Deployment Script
# Deploys the complete Overmind hybrid memory system to Kubernetes

set -e

echo "🚀 Starting Overmind production deployment..."

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Create namespace if it doesn't exist
echo "📁 Creating overmind namespace..."
kubectl create namespace overmind --dry-run=client -o yaml | kubectl apply -f -

# Set context to overmind namespace
echo "🔧 Setting kubectl context to overmind namespace..."
kubectl config set-context --current --namespace=overmind

# Apply secrets
echo "🔐 Applying secrets..."
kubectl apply -f k8s/secrets.yaml

# Apply configmap
echo "⚙️ Applying configmap..."
kubectl apply -f k8s/configmap.yaml

# Apply bridge deployment and service
echo "🌉 Deploying bridge service..."
kubectl apply -f k8s/bridge-deployment.yaml

# Apply API deployment and service
echo "🔌 Deploying API service..."
kubectl apply -f k8s/api-deployment.yaml

# Apply HPA
echo "📈 Applying horizontal pod autoscaler..."
kubectl apply -f k8s/hpa.yaml

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/overmind-bridge
kubectl wait --for=condition=available --timeout=300s deployment/overmind-api

# Apply ingress (optional - requires domain configuration)
echo "🌐 Applying ingress (update domain in ingress.yaml first)..."
kubectl apply -f k8s/ingress.yaml

# Apply Istio virtual service (optional - requires Istio)
echo "🔀 Applying Istio virtual service..."
kubectl apply -f k8s/istio-virtualservice.yaml

echo "✅ Overmind deployment complete!"
echo ""
echo "🔍 Check deployment status:"
echo "kubectl get pods -n overmind"
echo "kubectl get services -n overmind"
echo "kubectl get ingress -n overmind"
echo ""
echo "🧪 Test the deployment:"
echo "kubectl port-forward svc/overmind-api 8001:8001 -n overmind"
echo "curl http://localhost:8001/health"
echo ""
echo "📊 Monitor with:"
echo "kubectl top pods -n overmind"
echo "kubectl logs -f deployment/overmind-bridge -n overmind"