#!/bin/bash

set -e

echo "🔗 Setting up port forwarding for Price Runner services..."

# Kill any existing port-forward processes
pkill -f "kubectl port-forward" || true

# Port forward in background
echo "📡 Forwarding ports..."
kubectl port-forward -n price-runner service/frontend-service 8080:80 > /dev/null 2>&1 &
kubectl port-forward -n price-runner service/backend-service 3002:3001 > /dev/null 2>&1 &
kubectl port-forward -n price-runner service/prometheus-service 9091:9090 > /dev/null 2>&1 &
kubectl port-forward -n price-runner service/grafana-service 3003:3000 > /tmp/grafana-portforward.log 2>&1 &
sleep 1

sleep 2

echo "✅ Port forwarding active!"
echo ""
echo "📊 Services available at:"
echo "   Frontend:    http://localhost:8080"
echo "   Backend:    http://localhost:3002"
echo "   Prometheus: http://localhost:9091"
echo "   Grafana:    http://localhost:3003 (admin/admin)"
echo ""
echo "⚠️  Port forwarding is running in background. Use 'pkill -f kubectl port-forward' to stop."

