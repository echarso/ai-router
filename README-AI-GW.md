# Envoy AI Gateway + TinyLlama (CPU) on Kind

This guide deploys a **CPU-only** TinyLlama vLLM OpenAI-compatible server behind **Envoy AI Gateway**, inside a local **kind** Kubernetes cluster.

It matches the structure you requested:
- `Namespace: ai`
- `tinyllama` vLLM Deployment + Service
- Envoy AI Gateway resources: `GatewayClass`, `EnvoyProxy`, `Gateway`, `Backend`, `AIServiceBackend`, `AIGatewayRoute`, `ClientTrafficPolicy`
- Exposes an OpenAI-compatible API through the Gateway listener on port **1975**

## Prerequisites

- Docker running
- `kind`, `kubectl`
- `helm` (required for Envoy AI Gateway install)

## Deploy

1) Deploy the cluster + controllers + workloads:

```bash
cd /Users/harry/price-runner
./deploy-k8s.sh
```

Note: `k8s/aigateway-routing.yaml` is not used; AI routing is under `k8s/ai/*`.

2) Point `bestai.se` to localhost (if not already):

```bash
sudo sh -c 'echo "127.0.0.1 bestai.se" >> /etc/hosts'
```

3) Port-forward the Gateway Service listener port:
No port-forward is needed. We expose the AI Gateway listener via:
- a fixed NodePort (`31975`) and
- a kind host port mapping (`1975 -> 31975`)

So you can call:
- `http://bestai.se:1975/...`

## Call the OpenAI-compatible endpoint

### List models

```bash
curl -s -H "Host: bestai.se" http://bestai.se:1975/v1/models
```

### Chat completions (TinyLlama)

The route matches any `x-ai-eg-model`, and forwards to TinyLlama. Set it to `TinyLlama`:

```bash
curl -s -H "Host: bestai.se" \
  -H "Content-Type: application/json" \
  -H "x-ai-eg-model: TinyLlama" \
  http://bestai.se:1975/v1/chat/completions \
  -d '{
    "model":"TinyLlama",
    "messages":[{"role":"user","content":"Hello"}],
    "temperature":0.2
  }'
```

### Chat completions (FastAPI backend)

```bash
curl -s -H "Host: bestai.se" \
  -H "Content-Type: application/json" \
  -H "x-ai-eg-model: fast-api" \
  http://bestai.se:1975/v1/chat/completions \
  -d '{
    "model":"fast-api",
    "messages":[{"role":"user","content":"Hello"}]
  }'
```

## Logs

### vLLM / TinyLlama

```bash
kubectl logs -n ai deploy/tinyllama -f
```

### Envoy data plane (Gateway)

List the proxy pods (in `envoy-gateway-system`) and tail logs:

```bash
kubectl get pods -n envoy-gateway-system
kubectl logs -n envoy-gateway-system deploy/envoy-gateway -f
```

### Envoy AI Gateway controller

```bash
kubectl logs -n envoy-ai-gateway-system deploy/ai-gateway-controller -f
```

## Files

- `k8s/ai/00-namespace.yaml`
- `k8s/ai/10-tinyllama-vllm.yaml`
- `k8s/ai/20-envoy-ai-gateway.yaml`

## Notes / gotchas

- The first time TinyLlama starts, it must download model weights from Hugging Face. This can take a while on kind.
- `vllm/vllm-openai:latest` must be compatible with your node architecture. If pods fail with `exec format error`, your kind nodes are likely `arm64` and we need an `arm64`-compatible serving image.
- If you already have an existing kind cluster, you must recreate it after changing `kind-config.yaml` for the new port mapping:
  - `kind delete cluster --name price-runner`
  - `./deploy-k8s.sh`

