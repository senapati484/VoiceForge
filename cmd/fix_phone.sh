#!/bin/bash
# Fix Vapi phone number configuration to use correct server URL

PHONE_ID="0cf67c66-71b5-4275-99a4-3f5572018a77"
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"

# CHANGE THIS to your actual ngrok URL (should match the one in your .env)
NGROK_URL="https://karolyn-shiest-repentantly.ngrok-free.dev"

echo "Fixing phone number configuration..."
echo "Phone ID: $PHONE_ID"
echo "New serverUrl: $NGROK_URL/vapi/webhook"
echo ""

# Update the phone number with correct server URL
curl -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"server\": {
      \"url\": \"$NGROK_URL/vapi/webhook\",
      \"timeoutSeconds\": 20
    }
  }" \
  "https://api.vapi.ai/phone-number/$PHONE_ID" | python3 -m json.tool 2>/dev/null

echo ""
echo "Done!"
