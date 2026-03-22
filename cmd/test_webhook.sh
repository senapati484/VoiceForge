#!/bin/bash
# Test webhook POST request

curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":{"type":"assistant-request","call":{"id":"test-123","assistantId":"9102ea59-eb51-4222-a6d5-55d915b183d0"}}}' \
  https://karolyn-shiest-repentantly.ngrok-free.dev/vapi/webhook
