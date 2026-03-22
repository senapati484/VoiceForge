#!/bin/bash
# Setup Hugging Face Inference API for VoiceForge

set -e

echo "=== VoiceForge Hugging Face Setup ==="
echo ""

# Check if HF token is configured
if grep -q "HF_API_TOKEN=your_hf_token_here" /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env; then
    echo "❌ HF_API_TOKEN not configured!"
    echo ""
    echo "Steps to get your token:"
    echo "1. Go to: https://huggingface.co/settings/tokens"
    echo "2. Click 'New token' → Name it 'voiceforge'"
    echo "3. Copy the token (starts with 'hf_...')"
    echo "4. Open /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env"
    echo "5. Replace 'your_hf_token_here' with your actual token"
    echo "6. Run this script again"
    exit 1
fi

echo "✓ HF token found"
echo ""

# Update Vapi Assistant
echo "📞 Updating Vapi assistant..."

API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"
ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
PHONE_ID="0cf67c66-71b5-4275-99a4-3f5572018a77"
NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"serverUrl\": \"$NGROK_URL/vapi/webhook\",
    \"model\": {
      \"provider\": \"custom-llm\",
      \"url\": \"$NGROK_URL/api/llm/chat/completions\",
      \"model\": \"microsoft/Phi-3-mini-4k-instruct\",
      \"temperature\": 0.6
    }
  }" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" > /dev/null

echo "✓ Assistant updated"

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

echo "✓ Phone number updated"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "✅ VoiceForge is now using Hugging Face Inference API"
echo "   Model: microsoft/Phi-3-mini-4k-instruct"
echo ""
echo "Next steps:"
echo "1. Restart your API server:"
echo "   cd /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api && npm run dev"
echo ""
echo "2. Make a test call to +13197199131"
echo ""
echo "3. First request may take 5-10s (model loading)"
echo "   Subsequent requests will be faster"
