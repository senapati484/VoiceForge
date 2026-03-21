# Ngrok + Vapi Webhook Setup - Quick Reference

## The Big Picture

Vapi.ai needs to send webhooks to your local development server. Since your computer isn't publicly accessible, **ngrok creates a public tunnel** to your localhost.

```
Vapi.ai ───> https://your-url.ngrok-free.app (public) ───> localhost:4000 (your computer)
```

## Step-by-Step Setup

### Step 1: Install Ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start Your Local API Server

```bash
cd voiceforge-api
npm run dev

# Should show: "⚡ API on port 4000"
```

### Step 3: Start Ngrok Tunnel

```bash
# In a NEW terminal window
gngrok http 4000
```

You'll see output like:
```
Session Status                online
Account                       your@email.com (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123-def.ngrok-free.app -> http://localhost:4000
```

**Copy the HTTPS URL** (`https://abc123-def.ngrok-free.app`)

### Step 4: Update Environment Variables

Edit `voiceforge-api/.env`:

```bash
# OLD (expired):
# API_PUBLIC_URL=https://karolyn-shiest-repentably.ngrok-free.dev

# NEW (your current ngrok URL):
API_PUBLIC_URL=https://abc123-def.ngrok-free.app
```

### Step 5: Restart API Server

Stop and restart so it picks up the new URL:

```bash
# Press Ctrl+C to stop, then:
npm run dev
```

### Step 6: Verify It's Working

```bash
# Test in terminal:
curl https://abc123-def.ngrok-free.app/health

# Should return:
# { "status": "ok", "ts": "2026-03-21T..." }
```

### Step 7: Create an Agent (Webhooks Will Work Now!)

Go to your frontend (`http://localhost:3000/dashboard/agents/new`) and create an agent. It will:

1. Create agent in your database
2. Call Vapi API with your ngrok URL as the webhook endpoint
3. Vapi will now send webhooks to your ngrok URL

---

## How Webhooks Flow

### When a Call Happens:

```
1. Vapi makes outbound call
   ↓
2. Call status changes (initiated, in-progress, completed)
   ↓
3. Vapi sends webhook to: https://your-ngrok-url.ngrok-free.app/api/calls/webhook
   ↓
4. Ngrok forwards to: http://localhost:4000/api/calls/webhook
   ↓
5. Your server processes the webhook (updates call logs, deducts credits, etc.)
```

### Webhook Events Vapi Sends:

| Event Type | When Sent | What Your Server Does |
|------------|-----------|---------------------|
| `function-call` | Agent needs context | Retrieves knowledge from Pinecone |
| `status-update` | Call status changes | Updates call status in database |
| `end-of-call-report` | Call ends | Saves transcript, deducts credits |

---

## Important Things to Know

### 1. Ngrok URLs Are Temporary (Free Plan)

**Every time you restart ngrok, you get a new URL.**

**What this means:**
- ✅ New agents created will use the new URL
- ❌ Old agents still have the OLD webhook URL stored in Vapi

**Solutions:**
- Option A: Delete and recreate agents after ngrok restarts
- Option B: Update webhook URLs in Vapi dashboard manually
- Option C: Use a paid ngrok plan for a fixed domain

### 2. No "Webhook Section" in Vapi Dashboard

You asked: *"didnt find the webhook section"*

**There is NO webhook section in Vapi dashboard for assistants.** Instead:

1. When your backend creates an assistant via API, it sends:
   ```json
   {
     "name": "My Agent",
     "serverUrl": "https://your-ngrok-url.ngrok-free.app/api/calls/webhook",
     ...
   }
   ```

2. Vapi stores this URL with the assistant

3. To verify in dashboard:
   - Go to https://dashboard.vapi.ai
   - Click your assistant
   - Click "Advanced" tab
   - Look for "Server URL" field - that's your webhook!

### 3. Webhook Security

Your webhooks are secured with a secret. Vapi sends:
```
POST /api/calls/webhook
Headers:
  x-vapi-secret: 487f99b3f3ae473961d166ccf973509e0230cf9859ce67fefec2067d2ec8756b
```

Your server verifies this matches `VAPI_WEBHOOK_SECRET` in `.env`.

---

## Troubleshooting

### Issue: "Webhooks not being received"

**Check 1:** Is ngrok running?
```bash
# Terminal with ngrok should show "online"
```

**Check 2:** Is your API server running?
```bash
curl https://your-ngrok-url.ngrok-free.app/health
# Should return {"status":"ok"}
```

**Check 3:** Did the agent get created in Vapi?
```bash
# Check MongoDB or API response
GET /api/agents/:id
# Should have "vapiAgentId" field
```

**Check 4:** Verify webhook URL in Vapi dashboard:
1. Go to https://dashboard.vapi.ai
2. Find your assistant
3. Check "Advanced" → "Server URL"

### Issue: "ngrok URL expired"

**Solution:**
```bash
# Stop ngrok (Ctrl+C) and restart
gngrok http 4000

# Copy new URL
# Update .env
# Restart API server
# Recreate agents (or update webhook URLs in Vapi dashboard)
```

### Issue: "Vapi API error: 401"

**Cause:** Wrong API key

**Fix:**
1. Go to https://dashboard.vapi.ai → API Keys
2. Click "Create Server Key" (NOT Client Key!)
3. Copy the key (starts with your account ID)
4. Update `.env`: `VAPI_API_KEY=your-server-key`

---

## Commands Summary

```bash
# Terminal 1: Start API
cd voiceforge-api
npm run dev

# Terminal 2: Start Ngrok
gngrok http 4000

# Terminal 3: Start Frontend
cd voiceforge-web
npm run dev

# Verify ngrok is working
curl https://your-ngrok-url.ngrok-free.app/health

# View ngrok traffic (webhook debugging)
# Open http://127.0.0.1:4040 in browser
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         VAPI.AI (Cloud)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Assistant   │  │   Voice      │  │   Webhook    │        │
│  │  Config      │  │   Processing │  │   System     │        │
│  │              │  │              │  │              │        │
│  │ serverUrl:   │  │              │  │ Sends events │        │
│  │ ngrok-url    │  │              │  │ to ngrok-url │        │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘        │
│         │                                     │                │
│         │    Makes outbound calls             │                │
│         └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/calls/webhook
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGROK TUNNEL (Public)                       │
│            https://abc123-def.ngrok-free.app                   │
│                          │                                      │
│              Forwards requests to localhost:4000               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR LOCAL SERVER (Port 4000)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐│
│  │  Campaigns  │ │   Agents    │ │  Webhook    │ │   LLM     ││
│  │    API      │ │    API      │ │  Handler    │ │  Endpoint ││
│  └─────────────┘ └─────────────┘ └──────┬──────┘ └───────────┘│
│                                         │                      │
│                    Receives webhooks,   │                      │
│                    processes call events  │                      │
│                    updates database       │                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## FAQ

**Q: Do I need ngrok in production?**
A: No. In production (Railway, AWS, etc.), your server has a public URL. Just set `API_PUBLIC_URL` to that URL.

**Q: Why aren't webhooks working even though ngrok is running?**
A: The agent was created with an old ngrok URL. Either delete/recreate the agent or update the webhook URL in Vapi dashboard.

**Q: Can I use the same ngrok URL forever?**
A: No, free ngrok URLs change every time you restart ngrok. Use a paid plan for a fixed domain.

**Q: Where do I see webhook deliveries?**
A: Open http://127.0.0.1:4040 when ngrok is running - it shows all requests.

**Q: Is my ngrok URL secure?**
A: Anyone with the URL can reach your local server while ngrok is running. The webhook endpoint is protected by `x-vapi-secret` header validation.
