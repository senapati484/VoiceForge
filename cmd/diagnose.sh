#!/bin/bash
# Diagnose voice output issue

echo "=== VoiceForge Diagnostics ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

# Test 1: Ngrok endpoint reachable
echo "1. Testing ngrok endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NGROK_URL/health" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✓ API server is running${NC}"
else
    echo -e "   ${RED}✗ API server NOT responding (HTTP $HTTP_CODE)${NC}"
    echo "   → You need to start the API server: npm run dev"
    exit 1
fi

# Test 2: LLM endpoint
echo ""
echo "2. Testing LLM endpoint..."
RESPONSE=$(curl -s -X POST "$NGROK_URL/api/llm/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"system","content":"You are Olivia"},{"role":"user","content":"Hi"}],"temperature":0.6}' \
  2>/dev/null)

if echo "$RESPONSE" | grep -q '"content"'; then
    echo -e "   ${GREEN}✓ LLM endpoint working${NC}"
    echo "   Response: $(echo "$RESPONSE" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4 | cut -c1-50)..."
else
    echo -e "   ${RED}✗ LLM endpoint error${NC}"
    echo "   Response: $RESPONSE"
fi

# Test 3: Vapi assistant config
echo ""
echo "3. Checking Vapi configuration..."
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"
ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"

HAS_SYSTEM=$(curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" | grep -c '"systemPrompt"')

if [ "$HAS_SYSTEM" -gt 0 ]; then
    echo -e "   ${GREEN}✓ Assistant has systemPrompt${NC}"
else
    echo -e "   ${RED}✗ Assistant missing systemPrompt${NC}"
fi

echo ""
echo "=== Summary ==="
echo ""
echo "If all checks pass, make a test call:"
echo "  Call: +13197199131"
echo "  Ask: 'What is 5 times 4?'"
echo ""
echo "Watch the API server terminal for the 🤖 [LLM] logs"
