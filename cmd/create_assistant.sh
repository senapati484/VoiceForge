#!/bin/bash
curl -X POST \
  -H "Authorization: Bearer 8e3e5c2b-aef5-46d0-a065-0eb608d0b439" \
  -H "Content-Type: application/json" \
  -d '{"name":"Support Agent","model":{"provider":"custom-llm","url":"https://karolyn-shiest-repentantly.ngrok-free.dev/api/llm/chat/completions","model":"gemini-2.5-flash"},"voice":{"provider":"vapi","voiceId":"Elliot"},"serverUrl":"https://karolyn-shiest-repentantly.ngrok-free.dev/vapi/webhook","serverUrlSecret":"voiceforge-webhook-secret-123"}' \
  "https://api.vapi.ai/assistant"
