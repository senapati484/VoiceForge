# VoiceForge API Postman Testing Guide

This guide is based on the current `voiceforge-api` codebase and is meant to help you test the backend end to end with Postman.

## 1. What This API Exposes

Base URL:

```text
http://localhost:4000
```

Main route groups:

- `GET /health`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `GET /api/voices`
- `GET/POST/PATCH/DELETE /api/agents`
- `POST /api/knowledge/upload`
- `POST /api/knowledge/scrape`
- `GET /api/knowledge/status/:docId`
- `GET /api/knowledge`
- `GET /api/credits`
- `POST /api/credits/purchase`
- `POST /api/calls/outbound`
- `GET /api/calls`
- `GET /api/calls/:id`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/start`
- `POST /api/campaigns/:id/pause`
- `GET /api/campaigns`
- `GET /api/campaigns/:id`
- `GET /api/campaigns/:id/contacts`
- `POST /api/calls/webhook`

## 2. Startup Requirements

Important: this app does not start unless all required env vars are present, because `src/config.ts` hard-fails on missing values.

Required `.env` values:

- `MONGODB_URI`
- `JWT_SECRET`
- `SMOLIFY_API_KEY`
- `GEMINI_API_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `VAPI_API_KEY`
- `VAPI_WEBHOOK_SECRET`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `SMTP_USER`
- `SMTP_PASS`

Helpful defaults from `.env.example`:

- `PORT=4000`
- `FRONTEND_URL=http://localhost:3000`
- `API_PUBLIC_URL=http://localhost:4000`

Run locally:

```bash
npm install
npm run dev
```

The API also starts a background worker automatically. That worker checks for pending knowledge documents every 10 seconds and tries to ingest them into Pinecone.

## 3. Postman Environment

Create one Postman environment with these variables:

- `baseUrl` = `http://localhost:4000`
- `token` = blank initially
- `agentId` = blank initially
- `docId` = blank initially
- `campaignId` = blank initially
- `callId` = blank initially
- `vapiCallId` = blank initially
- `webhookSecret` = your `VAPI_WEBHOOK_SECRET`
- `testEmail` = an email you can receive OTP codes on
- `testPhone` = a real E.164 number like `+919876543210`

Recommended collection-level header for authenticated routes:

```text
Authorization: Bearer {{token}}
```

## 4. Best Testing Order

Use this order if you want to validate the whole backend with minimum confusion:

1. `GET /health`
2. `POST /api/auth/send-otp`
3. `POST /api/auth/verify-otp`
4. `GET /api/auth/me`
5. `GET /api/voices`
6. `POST /api/agents`
7. `GET /api/agents`
8. `POST /api/knowledge/upload` or `POST /api/knowledge/scrape`
9. `GET /api/knowledge/status/:docId` until `ready`
10. `GET /api/credits`
11. `POST /api/calls/outbound`
12. `GET /api/calls`
13. `POST /api/calls/webhook` to simulate Vapi callbacks
14. `POST /api/campaigns`
15. `POST /api/campaigns/:id/start`

## 5. Health Check

### GET `{{baseUrl}}/health`

Auth:

- Not required

Expected response:

```json
{
  "status": "ok",
  "ts": "2026-03-21T10:00:00.000Z"
}
```

## 6. Authentication

### A. Send OTP

### POST `{{baseUrl}}/api/auth/send-otp`

Auth:

- Not required

Body:

```json
{
  "email": "{{testEmail}}"
}
```

Success response:

```json
{
  "success": true,
  "message": "Code sent"
}
```

Notes:

- Rate limit is 3 OTP requests per email per 15 minutes.
- This only works cleanly in Postman if SMTP is configured and you can read the OTP email.
- OTP expires in 10 minutes.
- The OTP is not returned by the API and is stored as a bcrypt hash in MongoDB, so Postman-only testing depends on working email delivery.

### B. Verify OTP

### POST `{{baseUrl}}/api/auth/verify-otp`

Body:

```json
{
  "email": "{{testEmail}}",
  "otp": "123456"
}
```

Success response shape:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "USER_ID",
    "name": "user",
    "email": "user@example.com",
    "credits": 50,
    "plan": "free"
  }
}
```

Notes:

- New users are auto-created on first successful OTP verification.
- New users start with `50` credits.

Useful Postman test script:

```javascript
const data = pm.response.json();
pm.environment.set("token", data.token);
pm.environment.set("userId", data.user.id);
```

### C. Google Login

### POST `{{baseUrl}}/api/auth/google`

Body:

```json
{
  "idToken": "REAL_GOOGLE_ID_TOKEN"
}
```

Notes:

- This route calls Google `tokeninfo` directly, so it needs a real Google ID token.
- It also returns a JWT token plus user info.

### D. Current User

### GET `{{baseUrl}}/api/auth/me`

Auth:

- Required

Expected response:

```json
{
  "user": {
    "id": "USER_ID",
    "name": "user",
    "email": "user@example.com",
    "credits": 50,
    "plan": "free"
  }
}
```

## 7. Voices

### GET `{{baseUrl}}/api/voices`

Auth:

- Not required

Response shape:

```json
{
  "voices": [
    {
      "voiceId": "voice-id",
      "name": "Voice Name",
      "provider": "vapi",
      "previewUrl": "https://..."
    }
  ]
}
```

Notes:

- This route fetches from Vapi and caches the result for 1 hour.
- Use one `voiceId` and `name` from this response when creating an agent.

## 8. Agents

All agent routes require `Authorization: Bearer {{token}}`.

### A. Create Agent

### POST `{{baseUrl}}/api/agents`

Body:

```json
{
  "name": "Maya",
  "agentType": "sales",
  "businessName": "VoiceForge",
  "description": "VoiceForge helps businesses create AI voice agents for outbound sales, support, and campaign calling workflows.",
  "voiceId": "VOICE_ID_FROM_VOICES_API",
  "voiceName": "VOICE_NAME_FROM_VOICES_API",
  "language": "en-US",
  "tone": "professional",
  "callObjective": "Qualify the lead and book a product demo."
}
```

Success response:

```json
{
  "agent": {
    "_id": "AGENT_ID",
    "name": "Maya",
    "agentType": "sales"
  }
}
```

What happens internally:

- Mongo agent is created first.
- The app tries to build a knowledge file from all `ready` knowledge docs for that user.
- The app then tries to create a Vapi assistant.
- If knowledge file generation or Vapi assistant creation fails, the agent can still be created.

Useful Postman test script:

```javascript
const data = pm.response.json();
pm.environment.set("agentId", data.agent._id);
```

### B. List Agents

### GET `{{baseUrl}}/api/agents`

Returns all agents for the logged-in user.

### C. Get Single Agent

### GET `{{baseUrl}}/api/agents/{{agentId}}`

### D. Update Agent

### PATCH `{{baseUrl}}/api/agents/{{agentId}}`

Example body:

```json
{
  "tone": "friendly",
  "callObjective": "Book a demo for next week."
}
```

Notes:

- Updating `description` or `callObjective` regenerates the knowledge file.
- Updating `voiceId` also attempts to patch the Vapi assistant.

### E. Delete Agent

### DELETE `{{baseUrl}}/api/agents/{{agentId}}`

### F. Regenerate Context

### GET `{{baseUrl}}/api/agents/{{agentId}}/regenerate-context`

Use this after uploading knowledge docs and waiting for them to become `ready`.

Important behavior:

- Context generation currently uses all `ready` docs for the user, not only docs linked to that specific agent.

## 9. Knowledge Base

All knowledge routes require auth.

Credit usage:

- Document upload costs `5` credits
- URL scrape costs `2` credits

### A. Upload Document

### POST `{{baseUrl}}/api/knowledge/upload`

Body type:

- `form-data`

Fields:

- `file` = attach a `.pdf`, `.doc`, `.docx`, or `.txt` file
- `agentId` = optional

Success response:

```json
{
  "docId": "DOC_ID",
  "status": "pending"
}
```

Useful Postman test script:

```javascript
pm.environment.set("docId", pm.response.json().docId);
```

Notes:

- Max file size is 10 MB.
- Upload only creates the record and stores the raw file in R2.
- Actual ingestion happens later in the background worker.

### B. Scrape URL

### POST `{{baseUrl}}/api/knowledge/scrape`

Body:

```json
{
  "url": "https://example.com",
  "agentId": "{{agentId}}"
}
```

Success response:

```json
{
  "docId": "DOC_ID",
  "status": "pending"
}
```

Notes:

- The page text is scraped immediately, then stored and queued for ingestion.

### C. Check Ingestion Status

### GET `{{baseUrl}}/api/knowledge/status/{{docId}}`

Response shape:

```json
{
  "status": "ready",
  "chunkCount": 12,
  "filename": "pricing.pdf",
  "errorMsg": null,
  "type": "pdf"
}
```

Possible statuses:

- `pending`
- `processing`
- `ready`
- `error`

Testing note:

- Poll this every 10 to 15 seconds until it becomes `ready` or `error`.

### D. List Documents

### GET `{{baseUrl}}/api/knowledge`

Returns all knowledge documents for the logged-in user.

## 10. Credits

All credit routes require auth.

### A. Get Balance

### GET `{{baseUrl}}/api/credits`

Expected response:

```json
{
  "credits": 43,
  "transactions": []
}
```

### B. Purchase Credits

### POST `{{baseUrl}}/api/credits/purchase`

Body:

```json
{
  "packId": "starter"
}
```

Allowed values:

- `starter` adds `100`
- `growth` adds `500`
- `business` adds `2000`

Notes:

- This is a stub route right now and does not perform real payment verification.

## 11. Calls

### A. Start Outbound Call

### POST `{{baseUrl}}/api/calls/outbound`

Body:

```json
{
  "agentId": "{{agentId}}",
  "toNumber": "{{testPhone}}"
}
```

Requirements:

- Auth required
- Number must be E.164 format
- User must have at least `5` credits before the call starts
- Agent must exist, belong to the user, be active, and have `vapiAgentId`

Success response:

```json
{
  "callId": "CALL_LOG_ID",
  "vapiCallId": "VAPI_CALL_ID"
}
```

Useful Postman test script:

```javascript
const data = pm.response.json();
pm.environment.set("callId", data.callId);
pm.environment.set("vapiCallId", data.vapiCallId);
```

Important behavior:

- This route only creates the initial call log.
- Final duration, transcript, and credit deduction happen later through `/api/calls/webhook`.

### B. List Calls

### GET `{{baseUrl}}/api/calls`

Optional query:

- `page`

### C. Get Single Call

### GET `{{baseUrl}}/api/calls/{{callId}}`

## 12. Vapi Webhook Testing in Postman

This route does not use JWT auth. It validates the `x-vapi-secret` header.

Headers:

- `Content-Type: application/json`
- `x-vapi-secret: {{webhookSecret}}`

Endpoint:

### POST `{{baseUrl}}/api/calls/webhook`

### A. Test Function-Call Context Fetch

Body:

```json
{
  "type": "function-call",
  "functionCall": {
    "parameters": {
      "query": "What are your pricing plans?",
      "userId": "{{userId}}",
      "agentId": "{{agentId}}"
    }
  }
}
```

Expected result:

- Returns `{ "result": "..." }`
- The result is the generated system/context prompt

### B. Test Status Update

Body:

```json
{
  "type": "status-update",
  "status": "in-progress",
  "call": {
    "id": "{{vapiCallId}}"
  }
}
```

Expected result:

```json
{
  "received": true
}
```

This updates the matching call log status.

### C. Test End-of-Call Report

Body:

```json
{
  "type": "end-of-call-report",
  "call": {
    "id": "{{vapiCallId}}",
    "startedAt": "2026-03-21T10:00:00.000Z",
    "endedAt": "2026-03-21T10:02:20.000Z",
    "endedReason": "customer-ended"
  },
  "transcript": [
    {
      "role": "assistant",
      "text": "Hi, this is Maya from VoiceForge.",
      "timestamp": 0
    },
    {
      "role": "user",
      "text": "Sure, tell me more.",
      "timestamp": 4
    }
  ]
}
```

Expected behavior:

- Call log becomes `completed`
- `durationSec` is stored
- `creditsUsed` is set
- User credits are deducted at `3 credits per started minute`
- Credit ledger gets a deduction entry
- Campaign stats and contact status update if this call belongs to a campaign

## 13. Campaigns

All campaign routes require auth.

Important limitation:

- Campaign creation only works for `marketing` or `sales` agents.

### CSV Format Accepted

The parser looks for these columns:

- Phone column: one of `phone`, `mobile`, `number`, `contact`, `phonenumber`, `cell`
- Name column: one of `name`, `fullname`, `full_name`, `contactname`
- Notes column: one of `notes`, `comments`, `info`, `details`, `remarks`

Example CSV:

```csv
name,phone,notes
Rahul,+919876543210,Interested in demo
Anita,9876543211,Asked for pricing
```

Phone normalization behavior:

- 11 or more digits becomes `+<digits>`
- 10 digits becomes `+91<digits>`
- invalid numbers are skipped

### A. Create Campaign

### POST `{{baseUrl}}/api/campaigns`

Body type:

- `form-data`

Fields:

- `name` = `April Sales Push`
- `agentId` = `{{agentId}}`
- `csv` = attach the CSV file

Success response:

```json
{
  "campaign": {
    "_id": "CAMPAIGN_ID",
    "name": "April Sales Push",
    "status": "draft",
    "totalContacts": 2
  },
  "contactCount": 2
}
```

Useful Postman test script:

```javascript
pm.environment.set("campaignId", pm.response.json().campaign._id);
```

### B. Start Campaign

### POST `{{baseUrl}}/api/campaigns/{{campaignId}}/start`

Expected response:

```json
{
  "success": true,
  "message": "Campaign started"
}
```

What happens in the background:

- Campaign status becomes `running`
- Pending contacts are called one by one
- There is a 30-second delay between calls
- If credits drop below 5 before a call, the campaign pauses automatically

### C. Pause Campaign

### POST `{{baseUrl}}/api/campaigns/{{campaignId}}/pause`

### D. List Campaigns

### GET `{{baseUrl}}/api/campaigns`

### E. Get One Campaign

### GET `{{baseUrl}}/api/campaigns/{{campaignId}}`

### F. Get Campaign Contacts

### GET `{{baseUrl}}/api/campaigns/{{campaignId}}/contacts?page=1`

## 14. Validation and Error Shapes

Common auth error:

```json
{
  "error": "Unauthorized"
}
```

Expired or bad token:

```json
{
  "error": "Invalid or expired token"
}
```

Validation error shape:

```json
{
  "error": "Validation failed",
  "issues": [
    "Invalid phone number format (E.164 required)"
  ]
}
```

App-level error shape:

```json
{
  "error": "Agent not found"
}
```

## 15. Practical Notes While Testing

- `GET /api/voices` does not require auth.
- Most other business routes do require JWT auth.
- If `POST /api/agents` succeeds but `vapiAgentId` is missing, outbound calling will fail later.
- Knowledge uploads can stay `pending` or move to `error` if R2, Pinecone, or Gemini is not configured correctly.
- `POST /api/calls/outbound` creates the call record, but transcript and final credit deduction only appear after webhook events.
- If you are testing real Vapi callbacks instead of manual Postman webhook calls, `API_PUBLIC_URL` must be reachable by Vapi.

## 16. Minimum End-to-End Happy Path

If you only want a compact smoke path in Postman, use this:

1. `GET /health`
2. `POST /api/auth/send-otp`
3. `POST /api/auth/verify-otp`
4. `GET /api/voices`
5. `POST /api/agents`
6. `POST /api/knowledge/scrape`
7. `GET /api/knowledge/status/{{docId}}` until `ready`
8. `GET /api/agents/{{agentId}}/regenerate-context`
9. `POST /api/calls/outbound`
10. `POST /api/calls/webhook` with `status-update`
11. `POST /api/calls/webhook` with `end-of-call-report`
12. `GET /api/calls/{{callId}}`
13. `GET /api/credits`

## 17. Code References

If you want to cross-check any behavior, these are the main files:

- `src/index.ts`
- `src/config.ts`
- `src/routes/auth.ts`
- `src/routes/agents.ts`
- `src/routes/voices.ts`
- `src/routes/knowledge.ts`
- `src/routes/credits.ts`
- `src/routes/calls/index.ts`
- `src/routes/calls/webhook.ts`
- `src/routes/campaigns.ts`
- `src/validators/*.ts`
- `src/services/campaign.service.ts`
- `src/worker/index.ts`
- `src/rag/ingest.ts`
