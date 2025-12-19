#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}$1${NC}"
}

print_warn() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_step() {
    echo -e "${BLUE}$1${NC}"
}

# Check prerequisites
print_info "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v kind &> /dev/null; then
    print_error "❌ Kind is not installed. Please install it first:"
    print_error "   brew install kind  # macOS"
    print_error "   or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    print_error "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "❌ Docker is not running. Please start Docker first."
    exit 1
fi

print_info "✅ All prerequisites met!"
print_info ""

# Step 1: Build Docker images
print_step "📦 Step 1: Building Docker images..."
./build-images.sh

if [ $? -ne 0 ]; then
    print_error "❌ Failed to build Docker images"
    exit 1
fi

print_info ""

# Step 2: Check/Create Kind cluster
print_step "☸️  Step 2: Setting up Kind cluster..."

CLUSTER_EXISTS=false
if kind get clusters | grep -q "^price-runner$"; then
    CLUSTER_EXISTS=true
    print_warn "⚠️  Kind cluster 'price-runner' already exists"
    read -p "Do you want to recreate it? This will delete all existing data. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "🗑️  Deleting existing cluster..."
        kind delete cluster --name price-runner
        CLUSTER_EXISTS=false
    else
        print_info "📥 Using existing cluster and loading images..."
        kind load docker-image price-runner-backend:latest --name price-runner
        kind load docker-image price-runner-frontend:latest --name price-runner
    fi
fi

if [ "$CLUSTER_EXISTS" = false ]; then
    print_info "📦 Creating Kind cluster..."
    if [ ! -f "kind-config.yaml" ]; then
        print_error "❌ kind-config.yaml not found"
        exit 1
    fi
    kind create cluster --name price-runner --config kind-config.yaml
    
    # Wait for cluster to be ready
    print_info "⏳ Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=300s
    
    # Load Docker images into kind
    print_info "📥 Loading Docker images into Kind cluster..."
    kind load docker-image price-runner-backend:latest --name price-runner
    kind load docker-image price-runner-frontend:latest --name price-runner
fi

print_info ""

# Step 3: Prometheus/Grafana (disabled)
print_step "📝 Step 3: Prometheus/Grafana deployment is disabled (skipping)..."
print_warn "⚠️  Prometheus/Grafana steps are commented out in deploy-k8s.sh"

print_info ""

print_step "🌐 Step 4: Installing Envoy Gateway + Envoy AI Gateway (Helm)..."

print_info "🔍 Checking prerequisites for Envoy Gateway / AI Gateway..."
if ! command -v helm &> /dev/null; then
    print_error "❌ helm is not installed. Install helm to deploy Envoy AI Gateway:"
    print_error "   brew install helm  # macOS"
    exit 1
fi

print_info "📦 Installing Envoy Gateway (data plane/controller)..."
helm upgrade -i envoy-gateway oci://docker.io/envoyproxy/gateway-helm \
  --version v0.0.0-latest \
  --namespace envoy-gateway-system \
  --create-namespace

print_info "⏳ Waiting for Envoy Gateway..."
kubectl wait --timeout=3m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available || \
  print_warn "⚠️  Envoy Gateway wait timed out (may still be starting)"

print_info "📦 Installing Envoy AI Gateway CRDs..."
helm upgrade -i aieg-crd oci://docker.io/envoyproxy/ai-gateway-crds-helm \
  --version v0.0.0-latest \
  --namespace envoy-ai-gateway-system \
  --create-namespace

print_info "📦 Installing Envoy AI Gateway controller..."
helm upgrade -i aieg oci://docker.io/envoyproxy/ai-gateway-helm \
  --version v0.0.0-latest \
  --namespace envoy-ai-gateway-system \
  --create-namespace

print_info "⏳ Waiting for Envoy AI Gateway controller..."
kubectl wait --timeout=2m -n envoy-ai-gateway-system deployment/ai-gateway-controller --for=condition=Available || \
  print_warn "⚠️  AI Gateway controller wait timed out (may still be starting)"

print_info "✅ Envoy AI Gateway installed"
print_info ""

# Step 5: Apply Kubernetes manifests
print_step "📋 Step 5: Deploying to Kubernetes..."

if [ ! -d "k8s" ]; then
    print_error "❌ k8s directory not found"
    exit 1
fi

print_info "📦 Creating namespace..."
kubectl apply -f k8s/namespace.yaml

print_info "📦 Deploying Postgres (platform + keycloak)..."
kubectl apply -f k8s/postgres-platform.yaml
kubectl apply -f k8s/postgres-keycloak.yaml

print_info "📦 Deploying OpenBao..."
kubectl apply -f k8s/openbao.yaml

print_info "📦 Deploying Keycloak..."
kubectl apply -f k8s/keycloak.yaml

print_info "📦 Deploying platform DB migrations job..."
kubectl apply -f k8s/db-migrate-job.yaml

print_info "📦 Deploying Keycloak init job..."
kubectl apply -f k8s/keycloak-init-job.yaml

print_info "📦 Deploying backend-auth-service..."
kubectl apply -f k8s/backend-auth-service.yaml

print_warn "⚠️  Skipping vLLM TinyLlama (CPU) deployment (disabled to save CPU)."
print_warn "   (Would apply: k8s/vllm-tinyllama-cpu.yaml)"

print_info "📦 Deploying custom FastAPI (OpenAI-compatible)..."
kubectl apply -f k8s/custom-fastapi.yaml

print_info "📦 Deploying backend..."
kubectl apply -f k8s/backend-deployment.yaml

print_info "📦 Deploying frontend..."
kubectl apply -f k8s/frontend-deployment.yaml

print_warn "⚠️  Skipping Prometheus deployment (disabled)."
print_warn "   (Would apply: k8s/prometheus-config.yaml, k8s/prometheus-deployment.yaml)"

print_warn "⚠️  Skipping Grafana deployment (disabled)."
print_warn "   (Would apply: k8s/grafana-deployment.yaml)"

print_info "📦 Deploying OpenAI API mock service..."
kubectl apply -f k8s/openai-api-deployment.yaml

print_info "📦 Deploying Gateway (bestai.se)..."
kubectl apply -f k8s/envoy-gateway.yaml

print_info "📦 Exposing bestai-gateway on host :80 (NodePort 30081)..."
kubectl apply -f k8s/bestai-gateway-nodeport.yaml

print_warn "⚠️  Skipping k8s/aigateway-routing.yaml (deprecated)."
print_warn "   AI routing is deployed under k8s/ai/* via AIGatewayRoute in namespace 'ai'."

print_info "📦 Deploying OpenAI API Swagger routes..."
kubectl apply -f k8s/openai-api-swagger-route.yaml

print_info "📦 Deploying AI namespace TinyLlama + Envoy AI Gateway route..."
kubectl apply -f k8s/ai/00-namespace.yaml
print_warn "⚠️  Skipping AI namespace TinyLlama deployment (disabled to save CPU)."
print_warn "   (Would apply: k8s/ai/10-tinyllama-vllm.yaml)"
kubectl apply -f k8s/ai/15-fastapi.yaml
kubectl apply -f k8s/ai/20-envoy-ai-gateway.yaml
kubectl apply -f k8s/ai/25-ai-gateway-nodeport.yaml

# Wait a bit for Gateway to be processed
print_info "⏳ Waiting for Envoy Gateway to process Gateway resource..."
sleep 5

print_info ""

# Step 6: Wait for deployments
print_step "⏳ Step 6: Waiting for deployments to be ready..."

print_info "Waiting for backend..."
kubectl wait --for=condition=available --timeout=300s deployment/backend -n price-runner || print_warn "⚠️  Backend deployment timeout (may still be starting)"

print_info "Waiting for frontend..."
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n price-runner || print_warn "⚠️  Frontend deployment timeout (may still be starting)"

print_warn "⚠️  Skipping wait for Prometheus (disabled)."
print_warn "⚠️  Skipping wait for Grafana (disabled)."

print_info "Waiting for OpenAI API service..."
kubectl wait --for=condition=available --timeout=300s deployment/openai-api -n price-runner || print_warn "⚠️  OpenAI API deployment timeout (may still be starting)"

print_info ""

# Step 7: Set up port forwarding
print_step "🔗 Step 7: Setting up port forwarding..."

# Kill any existing port-forward processes
pkill -f "kubectl port-forward" || true
sleep 1

# Port forward in background
print_info "📡 Forwarding ports..."
kubectl port-forward -n price-runner service/frontend-service 8080:80 > /tmp/k8s-frontend-portforward.log 2>&1 &
kubectl port-forward -n price-runner service/backend-service 3002:3001 > /tmp/k8s-backend-portforward.log 2>&1 &
print_warn "⚠️  Skipping Prometheus port-forward (disabled)."
print_warn "⚠️  Skipping Grafana port-forward (disabled)."

sleep 2

# Check if port forwarding is working
if ! pgrep -f "kubectl port-forward.*frontend-service" > /dev/null; then
    print_warn "⚠️  Frontend port forwarding may have failed. Check logs: /tmp/k8s-frontend-portforward.log"
fi

print_info ""

# Step 7.5: Set up Envoy Gateway access
print_step "🌐 Step 7.5: Setting up Envoy Gateway access..."

if [ -f "./setup-envoy-access.sh" ]; then
    print_warn "⚠️  Skipping setup-envoy-access.sh (port-forward) — using NodePort mapping instead."
    print_warn "   bestai.se should be reachable on host port 80 via kind extraPortMappings."
    print_info ""
else
    print_warn "⚠️  setup-envoy-access.sh not found. Envoy Gateway access may need manual setup."
    print_info "   To access bestai.se, you may need to set up port forwarding manually."
    print_info ""
fi

print_info ""

# Step 8: Display status
print_step "📊 Step 8: Deployment Status"

print_info "✅ Deployment complete!"
print_info ""
print_info "📊 Services available at:"
print_info "   Frontend (via Envoy Gateway): http://bestai.se:8080 (or http://bestai.se if port 80 available)"
print_info "   Frontend (direct port forward): http://localhost:8080"
print_info "   Backend:                      http://localhost:3002"
print_info "   Prometheus:                   (disabled)"
print_info "   Grafana:                      (disabled)"
print_info ""
print_warn "⚠️  Note: To access bestai.se, ensure your /etc/hosts file includes:"
print_warn "   127.0.0.1 bestai.se"
print_info ""
print_info "📋 Pod Status:"
kubectl get pods -n price-runner
print_info ""
print_info "📋 Service Status:"
kubectl get services -n price-runner
print_info ""
print_warn "⚠️  Port forwarding is running in background."
print_info "   To stop port forwarding: pkill -f 'kubectl port-forward'"
print_info "   To view logs: kubectl logs -f <pod-name> -n price-runner"
print_info ""
