# Price Runner Backend - Architecture Documentation

## Overview

The Price Runner backend is a REST API service that provides LLM model pricing information and enables prompt routing to multiple LLM providers. The system is designed to be provider-agnostic and easily extensible.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼─────────────────────────────────────┐
│         Backend API Server                    │
│  ┌─────────────────────────────────────────┐ │
│  │  REST API Endpoints                     │ │
│  │  - /api/models                          │ │
│  │  - /api/get_best_price_for_prompt       │ │
│  │  - /api/send_prompt                     │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │  Data Service Layer                     │ │
│  │  - CSV Reader                           │ │
│  │  - (Future: Database)                   │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │  LLM Client Factory                     │ │
│  │  - Provider Detection                   │ │
│  │  - Client Instantiation                 │ │
│  └─────────────────────────────────────────┘ │
└────────┬───────────────────────────────────────┘
         │
    ┌────┴────┬──────────┬──────────┬──────────┐
    │         │          │          │          │
┌───▼───┐ ┌──▼───┐  ┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│OpenAI │ │Anthropic│ │Google │ │AWS    │ │Azure  │
│Client │ │Client  │ │Client │ │Client │ │Client │
└───────┘ └────────┘ └───────┘ └───────┘ └───────┘
```

### Component Architecture

#### 1. **API Layer** (`main.go`)
- RESTful endpoints using Gin framework
- Request validation and error handling
- CORS configuration
- Response formatting

#### 2. **Data Service Layer**
- CSV file reading for model pricing data
- Model filtering and querying
- Designed for future database migration

#### 3. **LLM Client Layer** (`clients.go`)
- Provider-specific client implementations
- Interface-based design for extensibility
- API key management from secrets.yaml
- Error handling and timeout management

#### 4. **Configuration Management**
- YAML-based secrets configuration
- Environment variable support
- Kubernetes/OpenBao secret compatibility

### Key Design Patterns

1. **Strategy Pattern**: Different LLM providers implement the `LLMClient` interface
2. **Factory Pattern**: `getLLMClient()` creates appropriate client based on model
3. **Dependency Injection**: Secrets and configuration injected at runtime
4. **Separation of Concerns**: Clear boundaries between API, business logic, and external services

### API Endpoints

#### `GET /api/models`
Returns all available models with pricing information.

#### `GET /api/models/provider/:provider`
Returns models filtered by provider name.

#### `GET /api/providers`
Returns list of all available providers.

#### `POST /api/get_best_price_for_prompt`
Calculates cost for a prompt across all models and returns sorted by cheapest.

**Request:**
```json
{
  "prompt": "Your prompt text here"
}
```

**Response:**
```json
{
  "success": true,
  "prompt": "Your prompt text here",
  "estimated_tokens": 25,
  "count": 34,
  "data": [
    {
      "model_name": "gpt-4o-mini",
      "provider": "OpenAI",
      "price_per_token": 0.00000015,
      "estimated_tokens": 25,
      "total_cost": 0.00000375,
      "mmlu_score": 79.0,
      "model_size": "Unknown"
    }
  ]
}
```

#### `POST /api/send_prompt`
Routes prompt to actual LLM providers and returns responses.

**Request:**
```json
{
  "prompt": "Your prompt text here",
  "model_names": ["gpt-4o", "claude-3-5-sonnet"],
  "providers": ["OpenAI", "Anthropic"]
}
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "model_name": "gpt-4o",
      "provider": "OpenAI",
      "success": true,
      "response": "Model response text..."
    }
  ]
}
```

### Secrets Configuration

The `secrets.yaml` file follows Kubernetes/OpenBao secret format:

```yaml
openai:
  api_key: "sk-..."
anthropic:
  api_key: "sk-ant-..."
google:
  api_key: "..."
aws:
  access_key_id: "..."
  secret_access_key: "..."
  region: "us-east-1"
```

### Error Handling

- API errors return appropriate HTTP status codes
- Provider-specific errors are wrapped with context
- Timeout handling (30 seconds default)
- Graceful degradation when API keys are missing

### Future Enhancements

1. **Database Integration**: Replace CSV with PostgreSQL/MongoDB
2. **Caching Layer**: Redis for model data and responses
3. **Rate Limiting**: Per-provider rate limit management
4. **Response Streaming**: Support for streaming responses
5. **Metrics & Monitoring**: Prometheus metrics, health checks
6. **Authentication**: JWT-based API authentication
7. **WebSocket Support**: Real-time prompt processing updates

---

## Python vs Go: Technology Comparison

### Performance

**Go:**
- ✅ Compiled language with excellent performance
- ✅ Low memory footprint
- ✅ Excellent concurrency with goroutines
- ✅ Fast startup time
- ✅ Ideal for high-throughput APIs

**Python:**
- ⚠️ Interpreted language, slower execution
- ⚠️ Higher memory usage
- ⚠️ GIL (Global Interpreter Lock) limits true parallelism
- ✅ Fast development iteration
- ✅ Good for I/O-bound operations

**Verdict for Price Runner:** Go is better for high-performance API serving and concurrent request handling.

### Development Speed

**Go:**
- ⚠️ More verbose syntax
- ⚠️ Less flexible type system
- ✅ Strong tooling (go fmt, go vet)
- ✅ Fast compilation
- ⚠️ Smaller ecosystem for some tasks

**Python:**
- ✅ Concise, readable syntax
- ✅ Extensive libraries (requests, pandas, etc.)
- ✅ Rapid prototyping
- ✅ Large community and resources
- ⚠️ Slower runtime performance

**Verdict for Price Runner:** Python is faster for initial development, but Go catches up with better tooling.

### Concurrency & Scalability

**Go:**
- ✅ Native goroutines (lightweight threads)
- ✅ Excellent for handling thousands of concurrent requests
- ✅ Built-in channels for communication
- ✅ No GIL limitations

**Python:**
- ⚠️ Threading limited by GIL
- ✅ asyncio for async I/O operations
- ⚠️ More complex concurrent programming
- ⚠️ Higher resource usage per request

**Verdict for Price Runner:** Go's concurrency model is superior for routing prompts to multiple providers simultaneously.

### Ecosystem & Libraries

**Go:**
- ✅ Excellent HTTP libraries (Gin, Echo)
- ✅ Good YAML/JSON support
- ⚠️ Fewer ML/AI specific libraries
- ✅ Growing ecosystem

**Python:**
- ✅ Extensive ecosystem (Flask, FastAPI, Django)
- ✅ Rich data science libraries
- ✅ Many LLM SDKs available
- ✅ Mature tooling

**Verdict for Price Runner:** Python has more LLM-specific libraries, but Go has sufficient HTTP/API libraries.

### Deployment & Operations

**Go:**
- ✅ Single binary deployment (no dependencies)
- ✅ Small Docker images
- ✅ Cross-platform compilation
- ✅ Easy containerization
- ✅ Low resource requirements

**Python:**
- ⚠️ Requires Python runtime
- ⚠️ Larger Docker images
- ⚠️ Dependency management complexity
- ✅ Easy to debug and inspect
- ⚠️ More runtime dependencies

**Verdict for Price Runner:** Go's single binary deployment is superior for containerized/Kubernetes environments.

### Learning Curve

**Go:**
- ⚠️ Different paradigm (channels, goroutines)
- ✅ Simple, consistent syntax
- ✅ Good documentation
- ⚠️ Less familiar to many developers

**Python:**
- ✅ Easy to learn
- ✅ Familiar syntax
- ✅ Extensive tutorials
- ✅ Large community

**Verdict for Price Runner:** Python is easier for teams new to the codebase, but Go is straightforward once learned.

### Cost Efficiency

**Go:**
- ✅ Lower CPU usage
- ✅ Lower memory usage
- ✅ Can handle more requests per server
- ✅ Lower infrastructure costs at scale

**Python:**
- ⚠️ Higher resource usage
- ⚠️ More servers needed for same load
- ⚠️ Higher infrastructure costs

**Verdict for Price Runner:** Go is more cost-effective at scale.

### Type Safety

**Go:**
- ✅ Strong static typing
- ✅ Compile-time error detection
- ✅ Prevents many runtime errors
- ✅ Better IDE support

**Python:**
- ⚠️ Dynamic typing (runtime errors)
- ✅ Type hints available (Python 3.5+)
- ⚠️ Less strict type checking
- ⚠️ More runtime surprises

**Verdict for Price Runner:** Go's type safety reduces bugs in production.

---

## Recommendation: Go for Price Runner

### Why Go is the Better Choice:

1. **Performance Requirements**: Routing prompts to multiple providers simultaneously requires excellent concurrency, which Go excels at.

2. **Scalability**: As the service grows, Go's efficiency means lower infrastructure costs and better resource utilization.

3. **Deployment**: Single binary deployment is ideal for Kubernetes/containerized environments, matching your OpenBao/Kubernetes secret requirements.

4. **Concurrent Operations**: Go's goroutines make it natural to send prompts to multiple providers in parallel without blocking.

5. **Production Readiness**: Go's performance characteristics and deployment simplicity make it better suited for production workloads.

### When Python Might Be Better:

- Rapid prototyping and experimentation
- Heavy use of Python-specific ML libraries
- Team expertise heavily favors Python
- Integration with existing Python ML infrastructure

### Hybrid Approach (Optional):

Consider using:
- **Go** for the main API server (performance, concurrency)
- **Python** for data processing/analysis scripts (if needed)
- Both can share the same `secrets.yaml` configuration

---

## Getting Started

### Go Backend Setup

```bash
cd backend-go

# Install dependencies
go mod download

# Run the server
go run main.go clients.go

# Or build and run
make build
./pricer-runner-backend
```

### Environment Variables

- `PORT`: Server port (default: 3001)

### Secrets Configuration

1. Copy `secrets.yaml` from project root
2. Add your API keys
3. Ensure file is in parent directory (../../secrets.yaml from backend-go)

### Testing

```bash
# Health check
curl http://localhost:3001/health

# Get all models
curl http://localhost:3001/api/models

# Calculate prompt cost
curl -X POST http://localhost:3001/api/get_best_price_for_prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world"}'

# Send prompt to models
curl -X POST http://localhost:3001/api/send_prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum computing", "providers": ["OpenAI"]}'
```

---

## Architecture Decisions

1. **Interface-based Design**: LLM clients implement a common interface, making it easy to add new providers
2. **YAML Secrets**: Compatible with Kubernetes secrets and OpenBao
3. **CSV First**: Start with CSV for simplicity, design for database migration
4. **RESTful API**: Standard HTTP/REST for easy frontend integration
5. **Error Handling**: Comprehensive error handling with meaningful messages
6. **Timeout Management**: 30-second timeouts prevent hanging requests

---

## Security Considerations

1. **Secrets Management**: Never commit `secrets.yaml` to version control
2. **API Key Validation**: Validate API keys before making requests
3. **Rate Limiting**: Implement rate limiting per provider (future)
4. **Input Validation**: Validate and sanitize all user inputs
5. **HTTPS**: Always use HTTPS in production
6. **CORS**: Configure CORS appropriately for production

---

## Monitoring & Observability (Future)

- Health check endpoints
- Request/response logging
- Error tracking
- Performance metrics
- Provider-specific metrics (latency, success rate)

