#!/bin/bash
# Update phone number to use correct assistant and server URL

PHONE_ID="0cf67c66-71b5-4275-99a4-3f5572018a77"
NEW_ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"

echo "Updating phone number..."
echo "Phone ID: $PHONE_ID"
echo "New Assistant ID: $NEW_ASSISTANT_ID"
echo ""

curl -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"assistantId\":\"$NEW_ASSISTANT_ID\"}" \
  "https://api.vapi.ai/phone-number/$PHONE_ID"

echo ""
echo ""
echo "Phone number updated!"
echo "The phone number +13197199131 should now use your new Oliviya assistant."
