# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY *.go ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o pricer-runner-backend .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/pricer-runner-backend .

# Copy secrets.yaml if it exists (for local development)
# In production, use Kubernetes secrets or environment variables
COPY ../../secrets.yaml* ./

EXPOSE 3001

CMD ["./pricer-runner-backend"]

