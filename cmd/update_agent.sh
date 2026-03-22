#!/bin/bash
# Script to update agent with new vapiAgentId

curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN_HERE" \
  -d '{"vapiAgentId":"6ba55ec8-f046-4f18-aff6-a95deee467ba"}' \
  "http://localhost:4000/api/agents/YOUR_AGENT_ID_HERE"
