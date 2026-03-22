#!/bin/bash
API_KEY="8e3e5c2b-aef5-46d0-a065-0eb608d0b439"
ASSISTANT_ID="9102ea59-eb51-4222-a6d5-55d915b183d0"

echo "Force-updating Vapi assistant with new systemPrompt..."
curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "url": "https://karolyn-shiest-repentantly.ngrok-free.dev/api/llm/chat/completions",
      "model": "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
      "provider": "custom-llm",
      "temperature": 0.6,
      "systemPrompt": "You are Olivia, a helpful and friendly support agent for VoiceForge, an AI Voice Agent platform. Speak warmly and keep responses to 1-2 sentences."
    },
    "firstMessage": "Thank you for calling VoiceForge. I am Olivia. How can I help?"
  }' \
  "https://api.vapi.ai/assistant/$ASSISTANT_ID" > /dev/null

echo "Done! Now make a test call and WAIT 2-3 seconds after speaking."
