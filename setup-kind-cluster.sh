#!/bin/bash

set -e

echo "🚀 Setting up Kind Kubernetes cluster for Price Runner..."

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "❌ Kind is not installed. Please install it first:"
    echo "   brew install kind  # macOS"
    echo "   or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install it first."
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install it first."
    exit 1
fi

# Create kind cluster
echo "📦 Creating Kind cluster..."
kind create cluster --name price-runner --config kind-config.yaml

# Wait for cluster to be ready
echo "⏳ Waiting for cluster to be ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=300s

# Load Docker images into kind
echo "📥 Loading Docker images into Kind cluster..."
kind load docker-image price-runner-backend:latest --name price-runner
kind load docker-image price-runner-frontend:latest --name price-runner
kind load docker-image price-runner-auth-service:latest --name price-runner || true
kind load docker-image price-runner-custom-fastapi:latest --name price-runner || true

# Apply Kubernetes manifests
echo "📋 Applying Kubernetes manifests..."
./deploy-k8s.sh

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/backend -n price-runner
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n price-runner
kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n price-runner
kubectl wait --for=condition=available --timeout=300s deployment/grafana -n price-runner

echo "✅ Cluster setup complete!"
echo ""
echo "📊 Services:"
echo "   Frontend:    http://localhost:8080"
echo "   Backend:    http://localhost:3002"
echo "   Prometheus: http://localhost:9091"
echo "   Grafana:    http://localhost:3003 (admin/admin)"
echo "   AI Gateway: http://bestai.se:1975"
echo ""
echo "🔗 Run './port-forward.sh' to set up port forwarding"

