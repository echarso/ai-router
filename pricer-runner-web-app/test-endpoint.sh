#!/bin/bash
# Test script to verify the backend endpoint is working

echo "Testing /api/get_best_price_for_prompt endpoint..."
echo ""

curl -X POST http://localhost:3001/api/get_best_price_for_prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, this is a test prompt"}' \
  -w "\n\nHTTP Status: %{http_code}\n"

echo ""
echo "If you see HTTP Status: 200, the endpoint is working!"
echo "If you see HTTP Status: 404, the endpoint path might be wrong."
echo "If you see 'Connection refused', the backend server is not running."

