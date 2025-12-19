#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if --local flag is provided
LOCAL_INSTALL=false
if [[ "$1" == "--local" ]] || [[ "$1" == "local" ]]; then
    LOCAL_INSTALL=true
fi

# Function to comment out Prometheus metrics in backend services
comment_out_metrics() {
    print_info "📝 Commenting out Prometheus metrics for local installation..."
    
    BACKEND_DIR="pricer-runner-web-app/backend"
    
    # Node.js backend - Comment out prometheus import and usage
    if [ -f "$BACKEND_DIR/server.js" ]; then
        # Create backup if it doesn't exist
        if [ ! -f "$BACKEND_DIR/server.js.backup" ]; then
            cp "$BACKEND_DIR/server.js" "$BACKEND_DIR/server.js.backup"
        fi
        
        # Use Python to properly comment out the metrics code
        python3 << 'PYTHON_SCRIPT'
file_path = "pricer-runner-web-app/backend/server.js"

with open(file_path, 'r') as f:
    lines = f.readlines()

# Comment out the prometheus import
for i, line in enumerate(lines):
    if 'prometheus' in line.lower() and 'require' in line:
        if not line.strip().startswith('//'):
            # Preserve indentation
            indent = len(line) - len(line.lstrip())
            lines[i] = ' ' * indent + '// Prometheus metrics disabled for local installation\n' + \
                       ' ' * indent + '// ' + line.lstrip()
        break

# Comment out metrics recording section
# Find lines from "// Record metrics" comment to the closing of the forEach
in_metrics_section = False
metrics_start = -1
for i, line in enumerate(lines):
    # Start of metrics section - find the comment "// Record metrics"
    if '// Record metrics' in line:
        in_metrics_section = True
        metrics_start = i
        continue
    
    # If we're in the metrics section, comment out code lines
    if in_metrics_section:
        # Comment out non-empty, non-comment lines
        if line.strip() and not line.strip().startswith('//'):
            indent = len(line) - len(line.lstrip())
            lines[i] = ' ' * indent + '// ' + line.lstrip()
        
        # End of metrics section - the forEach closing });
        # Check if this line has }); and we've seen promptCostHistogram
        if '});' in line:
            # Look back a few lines to see if we're in the metrics forEach
            context = ''.join(lines[max(0, i-5):i+1])
            if 'promptCostHistogram' in context and 'forEach' in context:
                break

with open(file_path, 'w') as f:
    f.writelines(lines)

print("✅ Commented out Prometheus metrics in Node.js backend")
PYTHON_SCRIPT
        
        print_info "✅ Commented out Prometheus metrics in Node.js backend"
    fi
    
    # Note: Go and Python backends don't have Prometheus metrics implemented yet
    # If they are added in the future, they should be commented out here too
}

# Function to restore Prometheus metrics (uncomment)
restore_metrics() {
    print_info "📝 Restoring Prometheus metrics..."
    
    BACKEND_DIR="pricer-runner-web-app/backend"
    
    if [ -f "$BACKEND_DIR/server.js.backup" ]; then
        mv "$BACKEND_DIR/server.js.backup" "$BACKEND_DIR/server.js"
        print_info "✅ Restored Prometheus metrics in Node.js backend"
    fi
}

# Function to install locally
install_local() {
    print_info "🏠 Installing Smart Inference Scheduling Platform locally..."
    
    # Check prerequisites
    if ! command -v node &> /dev/null; then
        print_error "❌ Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "❌ npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "❌ docker-compose is not installed. Please install docker-compose first."
        exit 1
    fi
    
    # Comment out Prometheus metrics
    comment_out_metrics
    
    # Install backend dependencies
    print_info "📦 Installing backend dependencies..."
    cd pricer-runner-web-app/backend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    cd ../..
    
    # Install frontend dependencies
    print_info "📦 Installing frontend dependencies..."
    cd pricer-runner-web-app/frontend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    cd ../..
    
    # Install backend-auth-service dependencies
    print_info "🔑 Installing backend-auth-service dependencies..."
    cd backend-auth-service
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        print_info "📝 Creating backend-auth-service .env file..."
        cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=platform_db
DB_USER=platform_user
DB_PASSWORD=platform_pass
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=bestai
OPENBAO_URL=http://localhost:8200
OPENBAO_TOKEN=root-token
OPENBAO_MOUNT_PATH=secret
PORT=5007
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
EOF
    fi
    cd ..
    
    print_info "✅ Local installation complete!"
    print_info ""
    print_info "🚀 To start the application:"
    print_info "   ./start-local.sh"
    print_info ""
    print_info "📊 Services will be available at:"
    print_info "   Frontend:        http://localhost:5005"
    print_info "   Backend (API):   http://localhost:5006"
    print_info "   Auth Service:    http://localhost:5007"
    print_info "   Keycloak:        http://localhost:8080"
    print_info "   OpenBao:         http://localhost:8200"
    print_info ""
    print_info "👤 Default Users:"
    print_info "   System Owner:    system-owner / SO"
    print_info "   Org Admin:       org-admin / OA"
    print_info ""
    print_warn "⚠️  Prometheus metrics are disabled for local installation"
}

# Function to install on Kubernetes
install_kubernetes() {
    print_info "☸️  Installing Price Runner on Kubernetes..."
    
    # Check prerequisites
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
    
    # Restore metrics if they were commented out
    restore_metrics
    
    # Build Docker images
    print_info "🔨 Building Docker images..."
    ./build-images.sh
    
    # Check if cluster already exists
    if kind get clusters | grep -q "^price-runner$"; then
        print_warn "⚠️  Kind cluster 'price-runner' already exists"
        read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "🗑️  Deleting existing cluster..."
            kind delete cluster --name price-runner
        else
            print_info "📥 Loading images into existing cluster..."
            kind load docker-image price-runner-backend:latest --name price-runner
            kind load docker-image price-runner-frontend:latest --name price-runner
        fi
    fi
    
    # Create cluster if it doesn't exist
    if ! kind get clusters | grep -q "^price-runner$"; then
        print_info "📦 Creating Kind cluster..."
        kind create cluster --name price-runner --config kind-config.yaml
        
        # Wait for cluster to be ready
        print_info "⏳ Waiting for cluster to be ready..."
        kubectl wait --for=condition=Ready nodes --all --timeout=300s
        
        # Load Docker images into kind
        print_info "📥 Loading Docker images into Kind cluster..."
        kind load docker-image price-runner-backend:latest --name price-runner
        kind load docker-image price-runner-frontend:latest --name price-runner
    fi
    
    # Install Envoy Gateway
    print_info "🌐 Installing Envoy Gateway..."
    # Check and clean up any problematic CRDs from previous failed installs
    if kubectl get crd httproutes.gateway.networking.k8s.io &>/dev/null; then
        if ! kubectl get crd httproutes.gateway.networking.k8s.io -o jsonpath='{.status.conditions}' | grep -q "Established"; then
            kubectl delete crd httproutes.gateway.networking.k8s.io --ignore-not-found=true || true
        fi
    fi
    if kubectl get crd envoyproxies.gateway.envoyproxy.io &>/dev/null; then
        if ! kubectl get crd envoyproxies.gateway.envoyproxy.io -o jsonpath='{.status.conditions}' | grep -q "Established"; then
            kubectl delete crd envoyproxies.gateway.envoyproxy.io --ignore-not-found=true || true
        fi
    fi
    
    # Download the install.yaml file
    INSTALL_YAML="/tmp/envoy-gateway-install.yaml"
    print_info "📥 Downloading Envoy Gateway installation manifest..."
    curl -sL https://github.com/envoyproxy/gateway/releases/latest/download/install.yaml -o "$INSTALL_YAML"
    
    # Use server-side apply to handle large annotations in CRDs
    print_info "📦 Applying Envoy Gateway resources with server-side apply..."
    kubectl apply --server-side --field-manager=envoy-gateway-installer --force-conflicts -f "$INSTALL_YAML" 2>&1 | grep -v "Too long" || true
    
    # Clean up
    rm -f "$INSTALL_YAML"
    
    kubectl wait --namespace envoy-gateway-system \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/name=envoy-gateway \
      --timeout=300s || true
    
    # Apply Kubernetes manifests
    print_info "📋 Applying Kubernetes manifests..."
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/backend-deployment.yaml
    kubectl apply -f k8s/frontend-deployment.yaml
    kubectl apply -f k8s/prometheus-config.yaml
    kubectl apply -f k8s/prometheus-deployment.yaml
    kubectl apply -f k8s/grafana-deployment.yaml
    kubectl apply -f k8s/openai-api-deployment.yaml
    kubectl apply -f k8s/envoy-gateway.yaml
    kubectl apply -f k8s/openai-api-route.yaml
    kubectl apply -f k8s/openai-api-swagger-route.yaml
    
    # Wait a bit for Gateway to be processed
    print_info "⏳ Waiting for Envoy Gateway to process Gateway resource..."
    sleep 5
    
    # Set up Envoy Gateway access
    if [ -f "./setup-envoy-access.sh" ]; then
        print_info "📡 Setting up Envoy Gateway access..."
        ./setup-envoy-access.sh
    fi
    
    # Wait for deployments
    print_info "⏳ Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/backend -n price-runner || true
    kubectl wait --for=condition=available --timeout=300s deployment/frontend -n price-runner || true
    kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n price-runner || true
    kubectl wait --for=condition=available --timeout=300s deployment/grafana -n price-runner || true
    
    print_info "✅ Kubernetes installation complete!"
    print_info ""
    print_info "📊 Services:"
    print_info "   Frontend (via Envoy Gateway): http://bestai.se"
    print_info "   Frontend (port forward):      http://localhost:8080 (after port forwarding)"
    print_info "   Backend:                     http://localhost:3002 (after port forwarding)"
    print_info "   Prometheus:                  http://localhost:9091 (after port forwarding)"
    print_info "   Grafana:                     http://localhost:3003 (after port forwarding, admin/admin)"
    print_info ""
    print_warn "⚠️  Note: To access bestai.se, ensure your /etc/hosts file includes:"
    print_warn "   127.0.0.1 bestai.se"
    print_info ""
    print_info "🔗 Run './port-forward.sh' to set up port forwarding"
}

# Main installation logic
if [ "$LOCAL_INSTALL" = true ]; then
    install_local
else
    install_kubernetes
fi
