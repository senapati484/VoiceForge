#!/bin/bash
# Configure VoiceForge to use local LLM server

NGROK_URL="$1"

if [ -z "$NGROK_URL" ]; then
    echo "Usage: ./use_local_llm.sh <ngrok-url>"
    echo "Example: ./use_local_llm.sh https://abc123.ngrok-free.app"
    echo ""
    echo "First, run in another terminal: ngrok http 8000"
    echo "Then copy the HTTPS URL and run this script"
    exit 1
fi

API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"
ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
PHONE_ID="0cf67c66-71b5-4275-99a4-3f5572018a77"

echo "=== Configuring VoiceForge for Local LLM ==="
echo ""
echo "Local LLM Ngrok URL: $NGROK_URL"
echo ""

# Update .env file
echo "1. Updating voiceforge-api/.env..."
sed -i '' "s|API_PUBLIC_URL=.*|API_PUBLIC_URL=$NGROK_URL|g" /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env
echo "   ✓ Updated"

# Update Vapi Assistant
echo "2. Updating Vapi Assistant..."
curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"serverUrl\": \"$NGROK_URL/vapi/webhook\",
    \"model\": {
      \"provider\": \"custom-llm\",
      \"url\": \"$NGROK_URL/v1/chat/completions\",
      \"model\": \"meta-llama/Llama-3.1-8B-Instruct\",
      \"temperature\": 0.6
    }
  }" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" > /dev/null
echo "   ✓ Assistant updated"

# Update Phone Number
echo "3. Updating Phone Number..."
curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"server\": {
      \"url\": \"$NGROK_URL/vapi/webhook\",
      \"timeoutSeconds\": 20
    }
  }" \
  "https://api.vapi.ai/phone-number/$PHONE_ID" > /dev/null
echo "   ✓ Phone number updated"

echo ""
echo "=== Configuration Complete ==="
echo ""
echo "✅ VoiceForge is now configured to use your LOCAL LLM"
echo ""
echo "Next steps:"
echo "1. Restart your voiceforge-api server:"
echo "   cd /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api && npm run dev"
echo ""
echo "2. Make a test call to +13197199131"
echo ""
echo "3. Watch the local LLM server terminal for generation logs"
