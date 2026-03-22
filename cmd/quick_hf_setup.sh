#!/bin/bash
# Quick HF setup - one command to fix everything

echo "⚡ Quick HuggingFace Setup for VoiceForge"
echo ""

# Check HF token
if grep -q "HF_API_TOKEN=your_hf_token_here\|HF_API_TOKEN=$" /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env 2>/dev/null; then
    echo "❌ ERROR: HF_API_TOKEN not set!"
    echo ""
    echo "Quick fix:"
    echo "1. Get token: https://huggingface.co/settings/tokens"
    echo "2. Add to .env: HF_API_TOKEN=hf_your_token_here"
    exit 1
fi

echo "✓ HF token found"

# Update Vapi configs
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"
ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
PHONE_ID="0cf67c66-71b5-4275-99a4-3f5572018a77"
NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

echo "📞 Updating Vapi..."

curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"serverUrl\": \"$NGROK_URL/vapi/webhook\", \"model\": {\"provider\": \"custom-llm\", \"url\": \"$NGROK_URL/api/llm/chat/completions\", \"model\": \"microsoft/Phi-3-mini-4k-instruct\", \"temperature\": 0.6}}" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" > /dev/null

curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"server\": {\"url\": \"$NGROK_URL/vapi/webhook\", \"timeoutSeconds\": 30}}" \
  "https://api.vapi.ai/phone-number/$PHONE_ID" > /dev/null

echo "✓ Vapi updated"
echo ""
echo "🚀 DONE! Now:"
echo ""
echo "1. Restart your API server (Ctrl+C, then npm run dev)"
echo "2. Call +13197199131"
echo "3. First call may take 10s (HF loads model), then fast"
