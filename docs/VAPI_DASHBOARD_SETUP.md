# 🎯 Vapi Dashboard Setup - Complete Step-by-Step Guide

## ⚡ Quick Check: What Should Work After Setup

When you call your Vapi number, this should happen:

```
📞 You dial → 🤖 AI answers → 💬 You talk → 🔧 AI responds
```

If this doesn't happen, follow the steps below EXACTLY.

---

## 📋 Prerequisites (BEFORE configuring Vapi)

### Step 0.1: Start Your Backend
```bash
cd voiceforge-api
npm run dev
# Should show: "⚡ API on port 4000"
```

### Step 0.2: Start Ngrok
```bash
gngrok http 4000
# Copy the HTTPS URL (e.g., https://abc123-def.ngrok-free.app)
```

### Step 0.3: Update .env File
Edit `voiceforge-api/.env`:
```bash
API_PUBLIC_URL=https://abc123-def.ngrok-free.app  # Your ngrok URL
```

### Step 0.4: Restart Backend
```bash
# Stop with Ctrl+C, then restart
npm run dev
```

### Step 0.5: Verify Setup
```bash
cd voiceforge-api
node verify-setup.js
```

You should see "✅ All checks passed!"

---

## 🖥️ Vapi Dashboard Configuration

### 📱 PART 1: Phone Number Configuration

#### Step 1: Open Phone Numbers
1. Go to https://dashboard.vapi.ai/phone-numbers
2. Click on your purchased phone number

#### Step 2: Configure Server URL
```
┌────────────────────────────────────────────────────────┐
│ Phone Number Settings                                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📞 Number: +1-XXX-XXX-XXXX                            │
│                                                        │
│  Server URL:                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ https://abc123-def.ngrok-free.app/vapi/webhook │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  ⚠️  MUST include /vapi/webhook at the end!            │
│                                                        │
│  [Save Changes]                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Set the Server URL field to:**
```
https://your-ngrok-url.ngrok-free.app/vapi/webhook
```

**Click Save**

#### Step 3: Link to Assistant (⚠️ CRITICAL STEP)
```
┌────────────────────────────────────────────────────────┐
│ Inbound Settings                                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Assistant:  ┌─────────────────────────────────┐       │
│              │ ▼ Select an assistant           │       │
│              │   ─────────────────────────────   │       │
│              │   ○ None                        │       │
│              │   ● Alex (your assistant) ✅     │       │
│              │   ○ Other assistant             │       │
│              └─────────────────────────────────┘       │
│                                                        │
│  ❌ If set to "None", calls won't trigger AI!         │
│                                                        │
│  [Save Changes]                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Select your assistant from the dropdown**

**Click Save**

---

### 🤖 PART 2: Assistant Configuration (HIGHER PRIORITY)

**⚠️ IMPORTANT: Assistant-level URL overrides Phone-level URL!**

#### Step 4: Open Assistant Settings
1. Go to https://dashboard.vapi.ai/assistants
2. Click on your assistant (e.g., "Alex")

#### Step 5: Configure Advanced Settings
```
┌────────────────────────────────────────────────────────┐
│ Assistant: Alex                                        │
├────────────────────────────────────────────────────────┤
│ [General] [Voice] [Model] [Advanced] ⚠️                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Click "Advanced" tab                                  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Step 6: Set Server URL in Advanced
```
┌────────────────────────────────────────────────────────┐
│ Advanced Settings                                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Server URL:                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ https://abc123-def.ngrok-free.app/vapi/webhook │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  ℹ️ This overrides the phone number server URL         │
│                                                        │
│  Authorization:                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Type: Bearer Token                              │   │
│  │ Header: x-vapi-secret                           │   │
│  │ Value: your-webhook-secret-from-env             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  [Save Changes]                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Set Server URL to:**
```
https://your-ngrok-url.ngrok-free.app/vapi/webhook
```

**Optional but Recommended:**
- Set Authorization to "Bearer Token"
- Header name: `x-vapi-secret`
- Value: Your `VAPI_WEBHOOK_SECRET` from `.env`

**Click Save**

---

## 🧪 Testing Your Setup

### Method 1: "Talk to Assistant" Button (Easiest)

```
┌────────────────────────────────────────────────────────┐
│ Assistant: Alex                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Test] [Talk to Assistant] 🎤 ← CLICK THIS            │
│                                                        │
│  Enter your phone number:                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ +1 555 123 4567                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  [Call Me] ← CLICK TO TEST                             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Steps:**
1. Click "Talk to Assistant"
2. Enter YOUR cell phone number
3. Click "Call Me"
4. Answer your phone when it rings
5. You should hear: "Hello! Thanks for calling. How can I help you today?"

### Method 2: Direct Call

1. Call your Vapi number from your cell phone
2. The AI should answer immediately
3. Start talking!

---

## 📊 Expected Terminal Output

When a call comes in, your terminal should show:

```bash
# When call starts:
[Vapi Webhook] Received request: {
  headers: { 'x-vapi-secret': '...', ... },
  body: { message: { type: 'assistant-request', ... } }
}
[Vapi Webhook] Processing event type: assistant-request
[Vapi Webhook] Assistant request: { phoneNumber: {...}, call: {...} }

# As call progresses:
[Vapi Webhook] Processing event type: status-update
[Vapi Webhook] Status update: initiated for call abc-123
[Vapi Webhook] Processing event type: status-update
[Vapi Webhook] Status update: in-progress for call abc-123

# When call ends:
[Vapi Webhook] Processing event type: end-of-call-report
[Vapi Webhook] End of call report for abc-123
```

**If you see these logs → SUCCESS! 🎉**

---

## 🔧 Troubleshooting Common Issues

### Issue 1: "Call connects but no AI voice"

**Symptoms:** You call, it rings, but silence or hangs up

**Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Assistant not linked to phone | Go to Phone Numbers → Inbound Settings → Select Assistant |
| Wrong Server URL | Must be `https://.../vapi/webhook` (not `/api/calls/webhook`) |
| Ngrok URL expired | Restart ngrok, update .env, restart backend |
| Backend not running | Check terminal shows "⚡ API on port 4000" |

**Debug:**
```bash
# Test if webhook is reachable
curl https://your-ngrok-url.ngrok-free.app/vapi/webhook \
  -H "x-vapi-secret: your-secret" \
  -d '{"message":{"type":"assistant-request"}}'

# Should return assistant config, not error
```

---

### Issue 2: "AI answers but doesn't respond to me"

**Symptoms:** AI says hello but doesn't reply when you speak

**Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Custom LLM not configured | Check `/api/llm` endpoint is working |
| Gemini API key missing | Check `GEMINI_API_KEY` in .env |
| Model URL wrong | Check Vapi dashboard shows correct URL |

**Debug:**
```bash
# Test LLM endpoint
curl https://your-ngrok-url.ngrok-free.app/api/llm/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

---

### Issue 3: "Call ends immediately"

**Symptoms:** Call connects and hangs up right away

**Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Vapi credits depleted | Check Vapi dashboard for credit balance |
| Assistant config error | Check webhook logs for errors |
| Invalid voice ID | Verify voice ID exists in Vapi |

---

### Issue 4: "No logs in my terminal"

**Symptoms:** Call happens but nothing shows in backend terminal

**Debug Steps:**

1. **Check ngrok inspector:**
   ```
   Open: http://127.0.0.1:4040
   Look for POST requests to /vapi/webhook
   ```

2. **If no requests in ngrok:**
   - Wrong URL in Vapi dashboard
   - Assistant not linked to phone
   - Server URL missing `/vapi/webhook`

3. **If requests in ngrok but not in terminal:**
   - Backend not running on port 4000
   - Wrong ngrok URL in .env
   - Backend needs restart

---

## ✅ Setup Verification Checklist

Before testing, confirm:

- [ ] Backend running: `npm run dev` shows "⚡ API on port 4000"
- [ ] Ngrok running: Shows "Forwarding https://..."
- [ ] .env updated: `API_PUBLIC_URL` matches ngrok URL (without `/vapi/webhook`)
- [ ] Backend restarted after .env change
- [ ] Phone number Server URL: `https://.../vapi/webhook`
- [ ] Assistant Advanced → Server URL: `https://.../vapi/webhook`
- [ ] Phone number → Inbound Settings → Assistant: Selected (not "None")
- [ ] Run `node verify-setup.js` - all checks pass

---

## 🎯 Success Criteria

You've successfully configured everything when:

1. ✅ You call your Vapi number
2. ✅ AI answers within 2-3 rings
3. ✅ AI says: "Hello! Thanks for calling. How can I help you today?"
4. ✅ You can talk to the AI and it responds
5. ✅ Terminal shows webhook logs during the call

---

## 🚀 What to Do After It Works

Once basic calls work:

1. **Customize the AI:**
   - Update first message in Vapi dashboard
   - Change voice, language
   - Set custom system prompt

2. **Add Tools:**
   - Configure tools in assistant settings
   - Implement custom tools in `/vapi/tools`

3. **Deploy to Production:**
   - Deploy backend to Railway/Render/AWS
   - Update Server URL to production URL
   - No more ngrok needed!

---

## 📞 Support Resources

- **Vapi Docs:** https://docs.vapi.ai
- **Webhook Events:** https://docs.vapi.ai/server-url/events
- **Ngrok Docs:** https://ngrok.com/docs
- **Test Script:** `node verify-setup.js`

---

## 📝 Summary

**3 Things MUST Be Correct:**

1. **Backend is running** → Terminal shows "⚡ API on port 4000"
2. **Ngrok is active** → URL accessible and forwarding
3. **Vapi configured** → Assistant linked, Server URL includes `/vapi/webhook`

**The Magic Formula:**
```
Your Phone → Vapi → ngrok → Your Backend → AI Response
```

**If it's not working:** Run `node verify-setup.js` and follow the output.
