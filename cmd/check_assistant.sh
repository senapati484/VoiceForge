#!/bin/bash
# Check Vapi assistant configuration

ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"

echo "Checking Vapi assistant configuration..."
echo "Assistant ID: $ASSISTANT_ID"
echo ""

curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo ""
echo "Check complete. Look for:"
echo "  - serverUrl: should be set to your ngrok URL"
echo "  - isServerUrlSecretSet: should be true"
echo "  - model.provider: should be 'custom-llm'"
