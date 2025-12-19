# Price Runner

A full-stack web application for comparing LLM model pricing and calculating prompt costs across multiple providers. The application includes a React frontend, Node.js backend, and optional Kubernetes deployment with Prometheus and Grafana monitoring.

## Features

- 📊 Real-time LLM model pricing comparison
- 💰 Prompt cost calculator across all models
- 🎨 Modern, responsive UI with multiple themes
- 🔍 Advanced filtering and sorting
- 📈 Prometheus metrics and Grafana dashboards
- ☸️ Kubernetes deployment support
- 🏠 Local development support

## Quick Start

### Installation

The project includes an installation script that supports both local and Kubernetes installations:

```bash
# Local installation (Prometheus metrics disabled)
./install.sh --local

# Kubernetes installation (Prometheus metrics enabled)
./install.sh
```

### Running the Application

#### Local Development

To start the application locally:

```bash
./start-local.sh
```

This will start:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000

#### Kubernetes Deployment

To deploy the application to Kubernetes:

```bash
./deploy-k8s.sh
```

This will deploy all services, install Envoy Gateway, and set up port forwarding. Services will be available at:
- **Frontend (via Envoy Gateway)**: http://bestai.se:8080 (or http://bestai.se if port 80 available)
- **Frontend (port forward)**: http://localhost:8080
- **OpenAI-Compatible API**: http://bestai.se:8080/v1 (or http://bestai.se/v1 if port 80 available)
- **Backend**: http://localhost:3002
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3003 (admin/admin)

**Note:** To access `bestai.se` locally, add the following to your `/etc/hosts` file:
```
127.0.0.1 bestai.se
```

**OpenAI-Compatible API Endpoints:**
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions endpoint
- `POST /v1/completions` - Text completions endpoint

**Swagger UI Documentation:**
- **Swagger UI**: http://bestai.se:8080/docs (or http://bestai.se/docs if port 80 available)
- **OpenAPI Spec**: http://bestai.se:8080/openapi.json
- **Alternative**: http://bestai.se:8080/swagger (redirects to /docs)

The Swagger UI provides interactive API documentation where you can:
- View all available endpoints
- See request/response schemas
- Test API calls directly from the browser
- View example requests and responses

**Note:** The OpenAI API is currently a mock service with no actual model connected. It returns placeholder responses.

## Scripts Documentation

### Installation Scripts

#### `install.sh`

Main installation script that sets up the application for either local or Kubernetes deployment.

**Usage:**
```bash
./install.sh [--local]
```

**Options:**
- `--local` or `local`: Install locally without Kubernetes
- No flag: Install on Kubernetes

**What it does:**

**Local Installation (`--local` flag):**
1. Checks for Node.js and npm prerequisites
2. Comments out Prometheus metrics in backend services
3. Installs backend dependencies (`pricer-runner-web-app/backend/node_modules`)
4. Installs frontend dependencies (`pricer-runner-web-app/frontend/node_modules`)
5. Provides instructions to start the application

**Kubernetes Installation (no flag):**
1. Checks for Docker, Kind, and kubectl prerequisites
2. Restores Prometheus metrics if they were commented out
3. Builds Docker images for backend and frontend
4. Creates or uses existing Kind Kubernetes cluster
5. Loads Docker images into the cluster
6. Installs Envoy Gateway for ingress routing
7. Applies all Kubernetes manifests (namespace, deployments, services, Prometheus, Grafana, Envoy Gateway)
8. Waits for all deployments to be ready
9. Sets up port forwarding and provides access information

**Prometheus Metrics Handling:**
- When installing locally, the script automatically comments out all Prometheus metrics code in the backend to avoid unnecessary dependencies
- When installing on Kubernetes, the script restores the original code with metrics enabled
- A backup file (`server.js.backup`) is created for safe restoration

---

### Execution Scripts

#### `start-local.sh`

Starts the web application locally without Docker or Kubernetes.

**Usage:**
```bash
./start-local.sh
```

**What it does:**
1. Validates prerequisites (Node.js, npm)
2. Checks if dependencies are installed, installs them if missing
3. Starts the backend server on port 3001 (logs to `/tmp/price-runner-backend.log`)
4. Starts the frontend development server on port 3000 (logs to `/tmp/price-runner-frontend.log`)
5. Handles graceful shutdown on Ctrl+C
6. Displays service URLs and log file locations

**Features:**
- Automatic dependency installation
- Background process management
- Log file redirection for debugging
- Clean shutdown handling

**Service URLs:**
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

**Logs:**
- Backend logs: `tail -f /tmp/price-runner-backend.log`
- Frontend logs: `tail -f /tmp/price-runner-frontend.log`

---

#### `deploy-k8s.sh`

Deploys the entire application stack to a Kubernetes cluster (Kind).

**Usage:**
```bash
./deploy-k8s.sh
```

**What it does:**

1. **Prerequisites Check:**
   - Verifies Docker is installed and running
   - Verifies Kind is installed
   - Verifies kubectl is installed

2. **Build Docker Images:**
   - Builds `price-runner-backend:latest` image
   - Builds `price-runner-frontend:latest` image

3. **Cluster Setup:**
   - Checks if Kind cluster `price-runner` exists
   - Optionally recreates cluster if user confirms
   - Creates new cluster if it doesn't exist
   - Waits for cluster nodes to be ready
   - Loads Docker images into the cluster

4. **Prometheus Metrics:**
   - Restores Prometheus metrics code if it was commented out
   - Ensures metrics are enabled for Kubernetes deployment

5. **Envoy Gateway Installation:**
   - Installs Envoy Gateway CRDs and controller
   - Waits for Envoy Gateway to be ready

6. **Kubernetes Deployment:**
   - Creates `price-runner` namespace
   - Deploys backend service
   - Deploys frontend service
   - Deploys OpenAI-compatible API mock service
   - Deploys Prometheus with configuration
   - Deploys Grafana with dashboards
   - Configures Envoy Gateway with Gateway and HTTPRoute resources for `bestai.se`
   - Sets up routing: `/v1/*` → OpenAI API, `/` → Frontend

6. **Deployment Verification:**
   - Waits for all deployments to be available
   - Shows pod and service status

7. **Port Forwarding:**
   - Automatically sets up port forwarding for all services
   - Kills any existing port-forward processes
   - Runs port forwarding in background

**Service URLs (after deployment):**
- Frontend (via Envoy Gateway): http://bestai.se:8080
- Frontend (port forward): http://localhost:8080
- OpenAI API (via Envoy Gateway): http://bestai.se:8080/v1
- Backend: http://localhost:3002
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3003

**Note:** To access `bestai.se` locally, add `127.0.0.1 bestai.se` to your `/etc/hosts` file.

**OpenAI-Compatible API:**
The deployment includes a mock OpenAI-compatible API service accessible at `/v1/*` endpoints:
- `GET /v1/models` - Returns a list of mock models
- `POST /v1/chat/completions` - Chat completions (returns mock responses)
- `POST /v1/completions` - Text completions (returns mock responses)

**Swagger UI Access:**
- Interactive API documentation: http://bestai.se:8080/docs
- OpenAPI specification: http://bestai.se:8080/openapi.json
- Alternative URL: http://bestai.se:8080/swagger

The Swagger UI allows you to:
- Browse all API endpoints
- View detailed request/response schemas
- Test API calls directly in the browser
- See example payloads and responses

**Note:** This is currently a mock service with no actual model backend. You can connect it to a real model service later by updating the `openai-api-deployment.yaml` to point to your model service.

**Port Forwarding Logs:**
- Frontend: `/tmp/k8s-frontend-portforward.log`
- Backend: `/tmp/k8s-backend-portforward.log`
- Prometheus: `/tmp/k8s-prometheus-portforward.log`
- Grafana: `/tmp/k8s-grafana-portforward.log`

**To stop port forwarding:**
```bash
pkill -f 'kubectl port-forward'
```

**To view pod logs:**
```bash
kubectl logs -f <pod-name> -n price-runner
```

---

### Utility Scripts

#### `build-images.sh`

Builds Docker images for backend and frontend services.

**Usage:**
```bash
./build-images.sh
```

**What it does:**
1. Builds `price-runner-backend:latest` from `pricer-runner-web-app/backend/Dockerfile`
2. Builds `price-runner-frontend:latest` from `pricer-runner-web-app/frontend/Dockerfile`
3. Lists all built images

---

#### `setup-kind-cluster.sh`

Sets up a Kind Kubernetes cluster and deploys the application (legacy script, use `deploy-k8s.sh` instead).

**Usage:**
```bash
./setup-kind-cluster.sh
```

---

#### `update-images.sh`

Quickly rebuilds and updates only the application Docker images and deployments without recreating the cluster or touching other services.

**Usage:**
```bash
./update-images.sh
```

**What it does:**

1. **Prerequisites Check:**
   - Verifies Docker, Kind, and kubectl are installed
   - Checks if the `price-runner` cluster exists
   - Verifies the `price-runner` namespace exists

2. **Build Docker Images:**
   - Builds `price-runner-backend:latest` image
   - Builds `price-runner-frontend:latest` image

3. **Load Images into Cluster:**
   - Loads backend image into Kind cluster
   - Loads frontend image into Kind cluster

4. **Restart Deployments:**
   - Restarts backend deployment to use new image
   - Restarts frontend deployment to use new image

5. **Wait for Rollout:**
   - Waits for backend deployment to be ready
   - Waits for frontend deployment to be ready

6. **Display Status:**
   - Shows pod status for backend and frontend
   - Displays service URLs

**Use this script when:**
- You've made code changes to the backend or frontend
- You want to update the application without recreating the cluster
- You want to avoid reinstalling Envoy Gateway, Prometheus, or Grafana

**Note:** This script only updates backend and frontend deployments. It does not modify the cluster, CRDs, or other services.

---

#### `setup-envoy-access.sh`

Sets up port forwarding for Envoy Gateway to enable access to `bestai.se` domain.

**Usage:**
```bash
./setup-envoy-access.sh
```

**What it does:**

1. **Finds Envoy Gateway Service:**
   - Automatically locates the Envoy Gateway service for the `bestai-gateway`

2. **Port Selection:**
   - Checks if port 80 is available
   - Uses port 8080 if port 80 is already in use (requires root privileges)
   - Uses port 80 if available (may require sudo)

3. **Sets Up Port Forwarding:**
   - Kills any existing port-forward processes for the Envoy Gateway
   - Creates a new port-forward connection to the Envoy Gateway service
   - Runs in the background

4. **Provides Access Information:**
   - Displays the URL to access the site
   - Reminds about `/etc/hosts` configuration
   - Provides command to stop port forwarding

**Use this script when:**
- You need to access the frontend via `bestai.se` domain
- The Envoy Gateway service is not directly accessible
- You want to set up port forwarding for Envoy Gateway

**Note:** This script is automatically called by `deploy-k8s.sh` during deployment. You can also run it manually if port forwarding stops.

**Prerequisites:**
- Envoy Gateway must be installed and running
- Gateway resource `bestai-gateway` must exist in the `price-runner` namespace
- `/etc/hosts` should have: `127.0.0.1 bestai.se`

---

#### `port-forward.sh`

Sets up port forwarding for Kubernetes services (automatically handled by `deploy-k8s.sh`).

**Usage:**
```bash
./port-forward.sh
```

**What it does:**
- Forwards frontend service to localhost:8080
- Forwards backend service to localhost:3002
- Forwards Prometheus service to localhost:9091
- Forwards Grafana service to localhost:3003

---

## Project Structure

```
price-runner/
├── install.sh              # Main installation script
├── start-local.sh          # Start application locally
├── deploy-k8s.sh          # Deploy to Kubernetes
├── build-images.sh        # Build Docker images
├── update-images.sh       # Rebuild and update app images only
├── setup-envoy-access.sh  # Set up Envoy Gateway port forwarding
├── setup-kind-cluster.sh  # Legacy cluster setup
├── port-forward.sh        # Port forwarding utility
├── k8s/                   # Kubernetes manifests
│   ├── namespace.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── openai-api-deployment.yaml
│   ├── openai-api-route.yaml
│   ├── openai-api-swagger-route.yaml
│   ├── envoy-gateway.yaml
│   ├── prometheus-config.yaml
│   ├── prometheus-deployment.yaml
│   └── grafana-deployment.yaml
├── pricer-runner-web-app/ # Main application
│   ├── backend/           # Node.js backend
│   ├── frontend/          # React frontend
│   ├── backend-go/        # Go backend (alternative)
│   └── backend-python/     # Python backend (alternative)
├── llm_models_pricing.csv # Model pricing data
├── secrets.yaml           # API keys (not in git)
├── kind-config.yaml       # Kind cluster configuration
└── README.md             # This file
```

## Prerequisites

### For Local Development
- Node.js (v16 or higher)
- npm or yarn

### For Kubernetes Deployment
- Docker installed and running
- [Kind](https://kind.sigs.k8s.io/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed

## Configuration

### API Keys

Create a `secrets.yaml` file in the root directory (use `secrets.yaml.example` as a template):

```yaml
openai:
  api_key: "your-openai-key"
anthropic:
  api_key: "your-anthropic-key"
google:
  api_key: "your-google-key"
# ... other providers
```

## Monitoring

### Prometheus Metrics

The backend exposes the following Prometheus metrics:

- `prompt_comparisons_total`: Total number of prompt comparisons
- `prompt_savings_percentage`: Savings percentage per comparison
- `prompt_cost_usd`: Cost of prompts by model and provider

**Note:** Metrics are automatically disabled for local installations and enabled for Kubernetes deployments.

### Grafana Dashboards

Grafana includes two dashboards:

**1. Price Runner Savings Dashboard:**
- Savings percentage over time (line chart)
- Total comparisons count
- Average savings percentage
- Current savings percentage

**2. Web App & API Connections Dashboard:**
- Frontend (Web App) requests per second
- OpenAI API requests per second
- Total connection counts for both services
- Request rates for frontend and API
- HTTP status codes breakdown
- Active connections by route
- Request latency (P50, P95, P99)

**Access Grafana:**
- URL: http://localhost:3003 (via port forwarding)
- Default credentials: admin/admin
- Port forwarding is automatically set up by `deploy-k8s.sh`

## API Endpoints

- `GET /api/models` - Get all models
- `GET /api/models/provider/:provider` - Get models by provider
- `GET /api/providers` - Get list of all providers
- `POST /api/get_best_price_for_prompt` - Calculate prompt costs
- `POST /api/send_prompt` - Send prompt to LLM providers
- `GET /health` - Health check endpoint
- `GET /api-docs` - Swagger API documentation

## Troubleshooting

### Local Installation Issues

- **Node.js not found**: Install Node.js v16 or higher
- **Dependencies not installing**: Check internet connection and npm registry
- **Port already in use**: Stop other services using ports 3000 or 3001

### Kubernetes Deployment Issues

- **Docker not running**: Start Docker Desktop or Docker daemon
- **Kind cluster issues**: Delete and recreate with `kind delete cluster --name price-runner`
- **Images not found**: Run `./build-images.sh` before deploying
- **Pods not starting**: Check logs with `kubectl logs -n price-runner <pod-name>`
- **Port conflicts**: Modify ports in `kind-config.yaml` or port-forward commands

### Prometheus Metrics Issues

- **Metrics not showing**: Ensure you're using Kubernetes deployment (metrics disabled in local mode)
- **Backend metrics endpoint**: Metrics are exposed on the same port as the API (3001)

## Cleanup

### Local Installation
Simply stop the servers with Ctrl+C when running `start-local.sh`.

### Kubernetes Deployment

To remove the entire cluster:
```bash
kind delete cluster --name price-runner
```

To stop port forwarding:
```bash
pkill -f 'kubectl port-forward'
```

## Additional Documentation

- [Kubernetes Setup Guide](README-K8S.md) - Detailed Kubernetes deployment guide
- [Web App README](pricer-runner-web-app/README.md) - Application-specific documentation
- [Prompt History](prompt_history_chat.md) - Development history and prompts

## License

ISC
