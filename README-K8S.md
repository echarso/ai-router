# Price Runner - Kubernetes Setup with Prometheus & Grafana

This guide explains how to set up the Price Runner application with Prometheus and Grafana monitoring in a Kubernetes cluster using Kind.

## Prerequisites

- Docker installed and running
- [Kind](https://kind.sigs.k8s.io/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed

## Quick Start

1. **Build Docker images:**
   ```bash
   ./build-images.sh
   ```

2. **Set up Kind cluster and deploy:**
   ```bash
   ./setup-kind-cluster.sh
   ```

3. **Set up port forwarding:**
   ```bash
   ./port-forward.sh
   ```

## Accessing Services

After port forwarding is set up, access the services at:

- **Frontend UI**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000
  - Username: `admin`
  - Password: `admin`

## Architecture

- **Backend**: Node.js/Express API with Prometheus metrics exporter
- **Frontend**: React app served via Nginx
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards

## Metrics Exposed

The backend exposes the following Prometheus metrics:

- `prompt_comparisons_total`: Total number of prompt comparisons
- `prompt_savings_percentage`: Savings percentage per comparison
- `prompt_cost_usd`: Cost of prompts by model and provider

## Grafana Dashboard

The Grafana dashboard shows:
- Savings percentage over time (line chart)
- Total comparisons count
- Average savings percentage
- Current savings percentage

## Manual Steps

If you prefer to run commands manually:

1. **Create Kind cluster:**
   ```bash
   kind create cluster --name price-runner --config kind-config.yaml
   ```

2. **Load images:**
   ```bash
   kind load docker-image price-runner-backend:latest --name price-runner
   kind load docker-image price-runner-frontend:latest --name price-runner
   ```

3. **Apply Kubernetes manifests:**
   ```bash
   kubectl apply -f k8s/
   ```

4. **Check status:**
   ```bash
   kubectl get pods -n price-runner
   kubectl get services -n price-runner
   ```

5. **Port forward:**
   ```bash
   kubectl port-forward -n price-runner service/frontend-service 8080:80
   kubectl port-forward -n price-runner service/backend-service 3001:3001
   kubectl port-forward -n price-runner service/prometheus-service 9090:9090
   kubectl port-forward -n price-runner service/grafana-service 3000:3000
   ```

## Troubleshooting

- **Images not found**: Make sure you've built and loaded the images into Kind
- **Pods not starting**: Check logs with `kubectl logs -n price-runner <pod-name>`
- **Port conflicts**: Change ports in `kind-config.yaml` or port-forward commands
- **Grafana not showing data**: Ensure Prometheus is scraping metrics from the backend

## Cleanup

To remove the cluster:
```bash
kind delete cluster --name price-runner
```

