#!/bin/bash
# Pull required Ollama models for CollabOS
# Run after starting the Ollama container: docker compose -f docker/ollama/docker-compose.yml up -d
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
TIMEOUT=120

echo "Waiting for Ollama to be ready..."
for i in $(seq 1 $TIMEOUT); do
  if curl -sf "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
    echo "Ollama is ready"
    break
  fi
  if [ "$i" -eq "$TIMEOUT" ]; then
    echo "Ollama did not start within ${TIMEOUT}s"
    exit 1
  fi
  sleep 1
done

# Pull embedding model (nomic-embed-text: 274MB, CPU-only, excellent quality)
echo "Pulling nomic-embed-text embedding model..."
curl -sf -X POST "${OLLAMA_URL}/api/pull" \
  -H "Content-Type: application/json" \
  -d '{"name": "nomic-embed-text"}' | \
  while IFS= read -r line; do
    status=$(echo "$line" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('status',''))" 2>/dev/null || echo "")
    [ -n "$status" ] && echo "  $status"
  done

echo "nomic-embed-text pulled successfully"
echo ""
echo "Test embedding:"
curl -sf -X POST "${OLLAMA_URL}/api/embeddings" \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","prompt":"test"}' | \
  python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(f'  Vector dims: {len(d[\"embedding\"])}')"

echo ""
echo "Ollama setup complete. Set ENABLE_EMBEDDINGS=true and OLLAMA_URL=${OLLAMA_URL} in your .env"
