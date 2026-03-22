#!/bin/bash
# Check Vapi phone numbers

API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"

echo "Checking Vapi phone numbers..."
echo ""

curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.vapi.ai/phone-number" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo ""
echo "Check complete. Look for:"
echo "  - Phone number assigned to your assistant"
echo "  - assistantId field should match your agent"
