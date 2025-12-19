#!/bin/bash

# Script to set up access to Envoy Gateway for bestai.se

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}$1${NC}"
}

print_warn() {
    echo -e "${YELLOW}$1${NC}"
}

# Find the Gateway service (Envoy Gateway or Envoy AI Gateway)
ENVOY_NS="envoy-gateway-system"
ENVOY_SVC=$(kubectl get svc -n envoy-gateway-system -l gateway.envoyproxy.io/owning-gateway-name=bestai-gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$ENVOY_SVC" ]; then
    ENVOY_NS="envoy-ai-gateway-system"
    ENVOY_SVC=$(kubectl get svc -n envoy-ai-gateway-system -l gateway.envoyproxy.io/owning-gateway-name=bestai-gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
fi

if [ -z "$ENVOY_SVC" ]; then
    print_warn "⚠️  Envoy Gateway service not found. Is the Gateway deployed?"
    exit 1
fi

print_info "🔍 Found Gateway service: $ENVOY_SVC (namespace: $ENVOY_NS)"

# Kill any existing port forwards
pkill -f "kubectl port-forward.*$ENVOY_SVC" || true
sleep 1

# Check if port 80 is available (requires sudo)
if lsof -i :80 >/dev/null 2>&1; then
    print_warn "⚠️  Port 80 is already in use. Using port 8080 instead."
    PORT=8080
    print_info "📡 Setting up port forwarding: localhost:8080 -> Envoy Gateway:80"
    kubectl port-forward -n $ENVOY_NS svc/$ENVOY_SVC 8080:80 > /tmp/envoy-gateway-portforward.log 2>&1 &
    sleep 2
    
    if pgrep -f "kubectl port-forward.*$ENVOY_SVC" > /dev/null; then
        print_info "✅ Port forwarding active on port 8080"
        print_info ""
        print_info "🌐 Access your site at: http://bestai.se:8080"
        print_info "   (Make sure /etc/hosts has: 127.0.0.1 bestai.se)"
        print_info ""
        print_info "📝 To stop port forwarding: pkill -f 'kubectl port-forward.*$ENVOY_SVC'"
    else
        print_warn "❌ Port forwarding failed. Check /tmp/envoy-gateway-portforward.log"
        exit 1
    fi
else
    print_info "📡 Setting up port forwarding: localhost:80 -> Envoy Gateway:80"
    print_warn "⚠️  This requires sudo privileges for port 80"
    
    sudo kubectl port-forward -n $ENVOY_NS svc/$ENVOY_SVC 80:80 > /tmp/envoy-gateway-portforward.log 2>&1 &
    sleep 2
    
    if pgrep -f "kubectl port-forward.*$ENVOY_SVC" > /dev/null; then
        print_info "✅ Port forwarding active on port 80"
        print_info ""
        print_info "🌐 Access your site at: http://bestai.se"
        print_info "   (Make sure /etc/hosts has: 127.0.0.1 bestai.se)"
        print_info ""
        print_info "📝 To stop port forwarding: sudo pkill -f 'kubectl port-forward.*$ENVOY_SVC'"
    else
        print_warn "❌ Port forwarding failed. Check /tmp/envoy-gateway-portforward.log"
        exit 1
    fi
fi
