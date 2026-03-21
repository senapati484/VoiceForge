# VoiceForge Troubleshooting Guide

## Issues Fixed & How to Use

---

## 1. CSV Upload Issues - FIXED ✅

### What Was Wrong:
- CSV parser was too strict about column names
- No support for semicolon-delimited files
- No auto-detection of headerless CSVs
- Phone normalization only supported Indian (+91) numbers

### What I Fixed:
1. **Flexible column detection** - Now auto-detects phone columns with variations like: `phone`, `mobile`, `number`, `contact`, `phonenumber`, `cell`, `tel`, `telephone`
2. **Supports semicolon delimiters** - Common in European exports
3. **Headerless CSV support** - Auto-detects if first row is data vs headers
4. **Better phone normalization** - Now defaults to +1 (US) for 10-digit numbers
5. **Debug logging** - Server logs show detected columns for troubleshooting

### Required CSV Format:
```csv
name,phone,notes
John Doe,+15551234567,Interested in pro plan
Jane Smith,+15557654321,Call after 3pm
```

**Accepted column variations:**
- Phone: `phone`, `mobile`, `number`, `contact`, `tel`, etc.
- Name: `name`, `fullname`, `first_name`, `customer`, etc.
- Notes: `notes`, `comments`, `info`, `description`, etc.

---

## 2. Voice Agent Previews - FIXED ✅

### What Was Wrong:
- Fallback voices didn't have preview URLs
- Only "Elliot (Demo)" had a working preview

### What I Fixed:
- Added preview URLs for all voices using Vapi's standard format: `https://storage.vapi.ai/voice/{voiceId}.mp3`
- Voices now include: Elliot, Rohan, Emma, Clara, Nico, Kai, Sagar, Godfrey, Neil, Joseph, Jennifer, Michael, Sarah, Alex

---

## 3. Ngrok + Vapi Webhook Setup Guide

### Current Configuration (Already Set):
Your `.env` file already has:
```bash
API_PUBLIC_URL=https://karolyn-shiest-repentably.ngrok-free.dev
VAPI_API_KEY=b357a836-0e54-4ea9-864a-55e8db0855e6
VAPI_WEBHOOK_SECRET=487f99b3f3ae473961d166ccf973509e0230cf9859ce67fefec2067d2ec8756b
```

### How the Webhook System Works:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vapi.ai       │────▶│  Your Ngrok URL  │────▶│  Local Server   │
│  (Voice calls)  │     │ (Public tunnel)  │     │  (Port 4000)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │                           │
                              ▼                           ▼
                    https://karolyn-shiest-      http://localhost:4000
                    repentably.ngrok-free.dev
```

### What Happens When You Create an Agent:

1. **Frontend** sends agent data to `POST /api/agents`
2. **Backend** creates agent in MongoDB
3. **Backend** calls Vapi API to create a voice assistant:
   ```javascript
   POST https://api.vapi.ai/assistant
   {
     "name": "Your Agent Name",
     "voice": { "provider": "vapi", "voiceId": "elliot" },
     "serverUrl": "https://karolyn-shiest-repentably.ngrok-free.dev/api/calls/webhook",
     "model": {
       "provider": "custom-llm",
       "url": "https://karolyn-shiest-repentably.ngrok-free.dev/api/llm/chat/completions"
     }
   }
   ```
4. **Vapi stores this webhook URL** - When calls are made, Vapi sends webhooks to your ngrok URL

### Webhook Endpoints (Already Configured):

| Endpoint | Purpose | Vapi Event Types |
|----------|---------|------------------|
| `POST /api/calls/webhook` | Receives call events | `status-update`, `end-of-call-report`, `function-call` |
| `POST /api/llm/chat/completions` | Custom LLM endpoint | Agent asks your backend for responses |

### Important: Ngrok URL Must Be Running!

Your ngrok URL (`https://karolyn-shiest-repentably.ngrok-free.dev`) is **NOT a Vapi feature** - it's YOUR tunnel that must be running:

```bash
# Install ngrok (if not installed)
brew install ngrok

# Start ngrok tunnel to your local API server
ngrok http 4000

# This will give you a URL like: https://xxxx.ngrok-free.app
# Update API_PUBLIC_URL in .env with this URL
```

**⚠️ Important:** The ngrok URL in your `.env` (`karolyn-shiest-repentably.ngrok-free.dev`) looks like an old/free ngrok URL that may have expired. You need to:

1. **Start ngrok**: Run `ngrok http 4000` in your terminal
2. **Copy the new URL** (e.g., `https://abc123.ngrok-free.app`)
3. **Update `.env`**: Change `API_PUBLIC_URL` to the new URL
4. **Restart your API server**
5. **Recreate your agents** (so Vapi gets the new webhook URL)

### Troubleshooting Webhook Issues:

**Check if ngrok is running:**
```bash
curl https://karolyn-shiest-repentably.ngrok-free.dev/health
# Should return: { "status": "ok" }
```

**Verify Vapi received your webhook URL:**
1. Go to https://dashboard.vapi.ai
2. Find your assistant
3. Check "Advanced" → "Server URL" - should show your ngrok URL

**Common Issues:**
1. **Ngrok URL expired** - Free ngrok URLs change every restart
2. **Local server not running** - Make sure API is on port 4000
3. **Webhook secret mismatch** - Check `VAPI_WEBHOOK_SECRET` matches Vapi dashboard

---

## 4. Agent Creation Issues - Troubleshooting

### What Could Go Wrong:

1. **Vapi API Key Issues:**
   - Must use **Private/Server key** (not Public/Client key)
   - Get it from: https://dashboard.vapi.ai → API Keys → Create Server Key

2. **Invalid Voice ID:**
   - Voice IDs are case-sensitive
   - Use the exact ID from `/api/voices` endpoint

3. **Webhook URL Not Reachable:**
   - Vapi can't reach your ngrok URL
   - Check: `curl https://your-ngrok-url.ngrok-free.app/health`

### Debug Steps:

1. **Check server logs** when creating an agent:
   ```bash
   cd voiceforge-api
   npm run dev
   # Watch for "[Vapi] Creating assistant with config..." log
   ```

2. **Test Vapi API directly:**
   ```bash
   curl -X POST https://api.vapi.ai/assistant \
     -H "Authorization: Bearer $VAPI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Agent",
       "voice": { "provider": "vapi", "voiceId": "elliot" },
       "serverUrl": "https://your-ngrok-url.ngrok-free.dev/api/calls/webhook"
     }'
   ```

3. **Check if agent has vapiAgentId:**
   ```bash
   # In MongoDB or API response
   GET /api/agents/:id
   # Should have: vapiAgentId field populated
   ```

---

## 5. Quick Start Checklist

### First Time Setup:

1. **Start your local API server:**
   ```bash
   cd voiceforge-api
   npm install
   npm run dev
   # Should show: "⚡ API on port 4000"
   ```

2. **Start ngrok (in new terminal):**
   ```bash
   ngrok http 4000
   # Copy the https URL (e.g., https://abc123.ngrok-free.app)
   ```

3. **Update .env with new ngrok URL:**
   ```bash
   # In voiceforge-api/.env
   API_PUBLIC_URL=https://abc123.ngrok-free.app
   ```

4. **Restart API server** (to pick up new URL)

5. **Start frontend:**
   ```bash
   cd voiceforge-web
   npm install
   npm run dev
   ```

6. **Create an agent** - It should now successfully create in Vapi

### Every Time You Restart Ngrok:

1. Update `API_PUBLIC_URL` in `.env`
2. Restart API server
3. **Important:** Existing agents still have old webhook URLs! Either:
   - Delete and recreate agents, OR
   - Update Vapi assistants via dashboard with new URL

---

## 6. Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "CSV has no rows" | Empty file or parsing failed | Check file has data, try different format |
| "CSV must have a phone column" | Column name not recognized | Use: phone, mobile, number, contact |
| "Vapi API error: 401" | Wrong API key | Use Server key, not Client key |
| "Vapi API error: 400" | Invalid voice ID or config | Check voice exists in /api/voices |
| "Agent not configured" | vapiAgentId is null | Agent creation failed, check Vapi logs |
| Webhooks not received | Ngrok URL expired | Update API_PUBLIC_URL, restart |

---

## Summary of Files Modified:

1. **`voiceforge-api/src/services/campaign.service.ts`** - Fixed CSV parsing with better column detection, semicolon support, headerless CSV support, improved phone normalization

2. **`voiceforge-api/src/routes/voices.ts`** - Added preview URLs for all fallback voices

3. **`voiceforge-api/src/services/vapi.service.ts`** - Added debug logging for agent creation

To apply these changes, restart your API server.
