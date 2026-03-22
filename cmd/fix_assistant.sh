#!/bin/bash
# Fix Vapi assistant configuration to use correct URLs

ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"

# CHANGE THIS to your actual ngrok URL (should match the one in your .env)
NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

echo "Fixing assistant configuration..."
echo "Assistant ID: $ASSISTANT_ID"
echo "New serverUrl: $NGROK_URL/vapi/webhook"
echo "New LLM URL: $NGROK_URL/api/llm/chat/completions"
echo ""

# First, let's see current config
echo "Current configuration:"
curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" | python3 -m json.tool 2>/dev/null | head -50

echo ""
echo "Press Enter to update the assistant, or Ctrl+C to cancel..."
read

# Update the assistant with correct URLs
curl -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"serverUrl\": \"$NGROK_URL/vapi/webhook\",
    \"model\": {
      \"provider\": \"custom-llm\",
      \"url\": \"$NGROK_URL/api/llm/chat/completions\",
      \"model\": \"gemini-2.5-flash\",
      \"temperature\": 0.6
    }
  }" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" | python3 -m json.tool 2>/dev/null

echo ""
echo "Done!"
