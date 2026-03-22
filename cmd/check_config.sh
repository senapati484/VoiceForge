#!/bin/bash
# Check Vapi assistant and phone number configuration

ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
PHONE_ID="0cf67c66-71b5-4275-99a4-3f5572018a77"
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"

echo "=== VAPI CONFIGURATION CHECK ==="
echo ""

echo "1. Checking Assistant Configuration..."
echo "   Assistant ID: $ASSISTANT_ID"
echo ""
curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" | python3 -m json.tool 2>/dev/null | grep -A2 -E '"url"|"provider"|"systemPrompt"' | head -30

echo ""
echo "2. Checking Phone Number Configuration..."
echo "   Phone ID: $PHONE_ID"
echo ""
curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.vapi.ai/phone-number/$PHONE_ID" | python3 -m json.tool 2>/dev/null | grep -A2 -E '"url"|"server"' | head -20

echo ""
echo "=== URL COMPARISON ==="
echo "Look for mismatched domains (e.g., .app vs .dev, or different subdomain spellings)"
