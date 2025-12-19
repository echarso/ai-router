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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

print_info "🚀 Starting Smart Inference Scheduling Platform locally..."
print_info ""

# Start Docker services (Keycloak, OpenBao, PostgreSQL)
print_info "🐳 Starting Docker services (Keycloak, OpenBao, PostgreSQL)..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.auth.yml up -d
else
    docker compose -f docker-compose.auth.yml up -d
fi

# Wait for postgres-platform to be ready
print_info "⏳ Waiting for platform Postgres to be ready..."
POSTGRES_READY=false
for i in {1..60}; do
    if docker exec postgres-platform pg_isready -U platform_user -d platform_db > /dev/null 2>&1; then
        POSTGRES_READY=true
        break
    fi
    sleep 2
done

if [ "$POSTGRES_READY" = false ]; then
    print_error "❌ platform Postgres failed to start. Check Docker logs."
    exit 1
fi

# Apply schema updates on every start (init scripts only run on first DB init)
print_info "🗄️  Applying database schema (init-db.sql)..."
docker exec -i postgres-platform psql -U platform_user -d platform_db < ./init-db.sql > /tmp/price-runner-db-migrate.log 2>&1 || \
  print_warn "⚠️  DB schema apply may have warnings. See /tmp/price-runner-db-migrate.log"

# Wait for Keycloak to be ready
print_info "⏳ Waiting for Keycloak to be ready..."
KEYCLOAK_READY=false
for i in {1..60}; do
    if curl -s http://localhost:8080/realms/master > /dev/null 2>&1; then
        KEYCLOAK_READY=true
        break
    fi
    sleep 2
done

if [ "$KEYCLOAK_READY" = false ]; then
    print_error "❌ Keycloak failed to start. Check Docker logs."
    exit 1
fi

# Initialize Keycloak realm
print_info "🔐 Initializing Keycloak realm..."
./keycloak-init.sh || print_warn "⚠️  Keycloak initialization may have failed. Continuing..."

# Wait a bit for Keycloak to process initialization
sleep 3

# Start backend-auth-service
print_info "🔑 Starting backend-auth-service..."
cd backend-auth-service

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warn "⚠️  Auth service dependencies not found. Installing..."
    npm install
fi

# Start auth service in background
# Force correct Keycloak realm/url for auth-service (overrides any stale backend-auth-service/.env)
KEYCLOAK_URL="http://localhost:8080" \
KEYCLOAK_REALM="bestai" \
KEYCLOAK_ADMIN="admin" \
KEYCLOAK_ADMIN_PASSWORD="admin" \
PORT="5007" \
npm start > /tmp/price-runner-auth-service.log 2>&1 &
AUTH_SERVICE_PID=$!
cd ..

# Wait for auth service to start
print_info "⏳ Waiting for auth service to start..."
sleep 3

# Check if auth service is running
if ! kill -0 $AUTH_SERVICE_PID 2>/dev/null; then
    print_error "❌ Auth service failed to start. Check /tmp/price-runner-auth-service.log for details."
    docker-compose -f docker-compose.auth.yml down 2>/dev/null || docker compose -f docker-compose.auth.yml down 2>/dev/null || true
    exit 1
fi

print_info ""

# Check if we're in the right directory
if [ ! -d "pricer-runner-web-app" ]; then
    print_error "❌ pricer-runner-web-app directory not found. Please run this script from the project root."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    print_info ""
    print_warn "🛑 Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$AUTH_SERVICE_PID" ]; then
        kill $AUTH_SERVICE_PID 2>/dev/null || true
    fi
    if [ ! -z "$DOCKER_COMPOSE_PID" ]; then
        print_info "Stopping Docker services..."
        docker-compose -f docker-compose.auth.yml down 2>/dev/null || docker compose -f docker-compose.auth.yml down 2>/dev/null || true
    fi
    print_info "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Start backend
print_info "📦 Starting backend server..."
cd pricer-runner-web-app/backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warn "⚠️  Backend dependencies not found. Installing..."
    npm install
fi

# Start backend in background
npm start > /tmp/price-runner-backend.log 2>&1 &
BACKEND_PID=$!
cd ../..

# Wait for backend to start
print_info "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "❌ Backend failed to start. Check /tmp/price-runner-backend.log for details."
    exit 1
fi

# Start frontend
print_info "🎨 Starting frontend server..."
cd pricer-runner-web-app/frontend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warn "⚠️  Frontend dependencies not found. Installing..."
    npm install
fi

# Start frontend in background
npm run dev > /tmp/price-runner-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Wait for frontend to start
print_info "⏳ Waiting for frontend to start..."
sleep 3

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_error "❌ Frontend failed to start. Check /tmp/price-runner-frontend.log for details."
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

print_info ""
print_info "✅ All services are running!"
print_info ""
print_info "📊 Services available at:"
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
print_info "📝 Logs:"
print_info "   Backend:         tail -f /tmp/price-runner-backend.log"
print_info "   Frontend:        tail -f /tmp/price-runner-frontend.log"
print_info "   Auth Service:    tail -f /tmp/price-runner-auth-service.log"
print_info "   Docker Services: docker-compose -f docker-compose.auth.yml logs -f"
print_info ""
print_warn "⚠️  Press Ctrl+C to stop all servers"
print_info ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID $AUTH_SERVICE_PID
