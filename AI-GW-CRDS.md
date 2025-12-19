## AI Gateway objects / CRDs created by this repo

### `k8s/ai/*` (Envoy AI Gateway stack)
- **Namespace**: Isolates AI workloads into `ai` namespace.
- **Deployment (tinyllama)**: Runs vLLM TinyLlama OpenAI-compatible server.
- **Service (tinyllama)**: Stable in-cluster endpoint for TinyLlama.
- **Deployment (fast-api)**: Runs custom FastAPI OpenAI-compatible service.
- **Service (fast-api)**: Stable in-cluster endpoint for FastAPI.
- **GatewayClass**: Registers Envoy controller for Gateways.
- **EnvoyProxy**: Configures Envoy runtime and access logs.
- **Gateway**: Exposes listener on port 1975.
- **Backend**: Defines upstream endpoint for AI service.
- **AIServiceBackend**: Declares OpenAI schema for a Backend.
- **AIGatewayRoute**: Model-aware routing to AI service backends.
- **ClientTrafficPolicy**: Increases buffer limits for large LLMs.
- **Service (NodePort)**: Exposes Gateway listener via fixed NodePort.

### `k8s/envoy-gateway.yaml` (existing UI routing)
- **Gateway**: Exposes bestai.se HTTP listener for UI.
- **HTTPRoute (frontend-route)**: Routes `/` traffic to frontend service.

### `k8s/openai-api-*.yaml` (existing mock OpenAI service)
- **HTTPRoute (openai-api-route)**: Routes `/v1-mock` traffic to mock API.
- **HTTPRoute (openai-api-swagger-route)**: Routes docs endpoints to mock API.

## Why we don’t use HTTPRoute for AI model routing

`HTTPRoute` can match on **host/path/headers/query params**, but it **cannot** match on the OpenAI request body field `{"model": "..."}`.

Envoy **AI Gateway** provides AI-aware routing semantics via `AIGatewayRoute` + `AIServiceBackend` so that the gateway can treat backends as **OpenAI-compatible inference providers** and apply AI-specific behavior (like request cost metadata) and routing conventions.

So we use:
- `Gateway` for the network entry point
- `AIGatewayRoute` for model-aware inference routing

