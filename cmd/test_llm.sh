#!/bin/bash
# Test the LLM endpoint directly

NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

echo "Testing LLM endpoint directly..."
echo "URL: $NGROK_URL/api/llm/chat/completions"
echo ""

curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "system", "content": "You are Olivia, a helpful AI assistant."},
      {"role": "user", "content": "What is 5 times 4?"}
    ],
    "temperature": 0.6
  }' \
  "$NGROK_URL/api/llm/chat/completions" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo ""
echo "If you see a JSON response with 'choices', the LLM endpoint is working!"
