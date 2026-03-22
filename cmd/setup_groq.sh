#!/bin/bash
# Setup Groq for VoiceForge
# Run this after adding your GROQ_API_KEY to the .env file

set -e

echo "=== VoiceForge Groq Setup ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check if GROQ_API_KEY is set
if grep -q "GROQ_API_KEY=your_groq_api_key_here" /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env; then
    echo -e "${RED}❌ GROQ_API_KEY not configured!${NC}"
    echo ""
    echo "Please add your Groq API key to the .env file:"
    echo ""
    echo "1. Get your API key from: https://console.groq.com/keys"
    echo "2. Open /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env"
    echo "3. Replace 'your_groq_api_key_here' with your actual key"
    echo "4. Run this script again"
    echo ""
    exit 1
fi

# Extract the Groq API key from .env
GROQ_KEY=$(grep "GROQ_API_KEY=" /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api/.env | cut -d'=' -f2)
if [ -z "$GROQ_KEY" ] || [ "$GROQ_KEY" = "your_groq_api_key_here" ]; then
    echo -e "${RED}❌ GROQ_API_KEY not found in .env file!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Groq API key found${NC}"
echo ""

# 2. Update Vapi assistant to use Groq-compatible model name
echo "📞 Updating Vapi assistant configuration..."

API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"
ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"serverUrl\": \"$NGROK_URL/vapi/webhook\",
    \"model\": {
      \"provider\": \"custom-llm\",
      \"url\": \"$NGROK_URL/api/llm/chat/completions\",
      \"model\": \"llama-3.1-70b-versatile\",
      \"temperature\": 0.6
    }
  }" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" > /dev/null

echo -e "${GREEN}✓ Vapi assistant updated${NC}"
echo ""

# 3. Test Groq API directly
echo "🧪 Testing Groq API..."
TEST_RESPONSE=$(curl -s -X POST \
  https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-70b-versatile",
    "messages": [{"role": "user", "content": "Say hello"}],
    "temperature": 0.6
  }')

if echo "$TEST_RESPONSE" | grep -q '"content"'; then
    echo -e "${GREEN}✓ Groq API is working!${NC}"
else
    echo -e "${RED}✗ Groq API test failed${NC}"
    echo "Response: $TEST_RESPONSE"
    exit 1
fi
echo ""

# 4. Instructions for starting the server
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. ${YELLOW}Restart your API server:${NC}"
echo "   cd /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2/voiceforge-api"
echo "   npm run dev"
echo ""
echo "2. ${YELLOW}Make a test call:${NC}"
echo "   - Call: +13197199131"
echo "   - Ask: 'What is 5 times 4?'"
echo ""
echo "3. ${YELLOW}Check the logs${NC} - you should see:"
echo "   🤖 [LLM] ==========================================="
echo "   [LLM] REQUEST RECEIVED - ID: llm-XXXX"
echo "   [LLM] Using provider: Groq"
echo "   [LLM] Request completed in XXXms"
echo ""
echo "${GREEN}Groq Benefits:${NC}"
echo "• 20 requests/minute (vs Gemini's 20/day)"
echo "• 600k tokens/day free tier"
echo "• Blazing fast inference (Llama 3.1 70B)"
echo ""
