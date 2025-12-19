#!/bin/bash

set -e

echo "🔨 Building Docker images..."

# Build backend image
echo "📦 Building backend image..."
cd pricer-runner-web-app/backend
docker build -t price-runner-backend:latest .
cd ../..

# Build frontend image
echo "📦 Building frontend image..."
cd pricer-runner-web-app/frontend
docker build -t price-runner-frontend:latest .
cd ../..

echo "📦 Building backend-auth-service image..."
cd backend-auth-service
docker build -t price-runner-auth-service:latest .
cd ..

echo "📦 Building custom FastAPI image..."
cd custom-fastapi
docker build -t price-runner-custom-fastapi:latest .
cd ..

echo "✅ All images built successfully!"
echo ""
echo "📋 Images:"
docker images | grep price-runner

