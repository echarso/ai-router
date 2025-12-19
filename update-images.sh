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
    print_error "❌ Kind is not installed. Please install it first."
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

# Check if cluster exists
if ! kind get clusters | grep -q "^price-runner$"; then
    print_error "❌ Kind cluster 'price-runner' does not exist."
    print_error "   Please run './deploy-k8s.sh' first to create the cluster."
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace price-runner &>/dev/null; then
    print_error "❌ Namespace 'price-runner' does not exist."
    print_error "   Please run './deploy-k8s.sh' first to set up the cluster."
    exit 1
fi

print_info "✅ All prerequisites met!"
print_info ""

# Step 1: Build Docker images
print_step "🔨 Step 1: Building Docker images..."

print_info "📦 Building backend image..."
cd pricer-runner-web-app/backend
docker build -t price-runner-backend:latest .
cd ../..

print_info "📦 Building frontend image..."
cd pricer-runner-web-app/frontend
docker build -t price-runner-frontend:latest .
cd ../..

print_info "✅ Images built successfully!"
print_info ""

# Build backend-auth-service image
print_info "📦 Building backend-auth-service image..."
cd backend-auth-service
docker build -t price-runner-auth-service:latest .
cd ..

print_info "📦 Building custom FastAPI image..."
cd custom-fastapi
docker build -t price-runner-custom-fastapi:latest .
cd ..

# Step 2: Load images into Kind cluster
print_step "📥 Step 2: Loading images into Kind cluster..."

print_info "📦 Loading backend image..."
kind load docker-image price-runner-backend:latest --name price-runner

print_info "📦 Loading frontend image..."
kind load docker-image price-runner-frontend:latest --name price-runner

print_info "📦 Loading backend-auth-service image..."
kind load docker-image price-runner-auth-service:latest --name price-runner

print_info "📦 Loading custom FastAPI image..."
kind load docker-image price-runner-custom-fastapi:latest --name price-runner

print_info "✅ Images loaded into cluster!"
print_info ""

# Step 3: Restart deployments to use new images
print_step "🔄 Step 3: Restarting deployments..."

print_info "🔄 Restarting backend deployment..."
kubectl rollout restart deployment/backend -n price-runner

print_info "🔄 Restarting frontend deployment..."
kubectl rollout restart deployment/frontend -n price-runner

print_info "🔄 Restarting backend-auth-service deployment..."
kubectl rollout restart deployment/backend-auth-service -n price-runner

print_info "🔄 Restarting custom FastAPI deployment..."
kubectl rollout restart deployment/custom-fastapi -n price-runner

print_info ""

# Step 4: Wait for deployments to be ready
print_step "⏳ Step 4: Waiting for deployments to be ready..."

print_info "⏳ Waiting for backend to be ready..."
kubectl rollout status deployment/backend -n price-runner --timeout=300s || print_warn "⚠️  Backend rollout timeout (may still be starting)"

print_info "⏳ Waiting for frontend to be ready..."
kubectl rollout status deployment/frontend -n price-runner --timeout=300s || print_warn "⚠️  Frontend rollout timeout (may still be starting)"

print_info ""

# Step 5: Display status
print_step "📊 Step 5: Deployment Status"

print_info "✅ Image update complete!"
print_info ""
print_info "📋 Pod Status:"
kubectl get pods -n price-runner -l app=backend
kubectl get pods -n price-runner -l app=frontend
print_info ""
print_info "📊 Services available at:"
print_info "   Frontend (via Envoy Gateway): http://bestai.se"
print_info "   Frontend (port forward):      http://localhost:8080"
print_info "   Backend:                      http://localhost:3002"
print_info ""
