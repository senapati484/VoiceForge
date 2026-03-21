# 🎙️ VoiceForge - Complete 0 to 100 Setup Guide

This guide takes you from a fresh system to a fully working VoiceForge AI Voice Agent platform. Follow each step carefully.

---

## 📋 Table of Contents

1. [Prerequisites](#step-0-prerequisites)
2. [Clone & Structure](#step-1-clone-the-repository)
3. [MongoDB Setup](#step-2-mongodb-setup)
4. [Vapi Account Setup](#step-3-vapi-account-setup)
5. [Gemini AI Setup](#step-4-gemini-ai-setup)
6. [Cloudflare R2 Setup](#step-5-cloudflare-r2-setup)
7. [Backend Setup](#step-6-backend-setup)
8. [Frontend Setup](#step-7-frontend-setup)
9. [Ngrok Setup](#step-8-ngrok-setup-for-local-development)
10. [Environment Configuration](#step-9-environment-configuration)
11. [Database Initialization](#step-10-database-initialization)
12. [Vapi Dashboard Configuration](#step-11-vapi-dashboard-configuration)
13. [Running the Application](#step-12-running-the-application)
14. [Testing](#step-13-testing-your-setup)
15. [Creating Your First Agent](#step-14-creating-your-first-agent)
16. [Running Your First Campaign](#step-15-running-your-first-campaign)
17. [Troubleshooting](#step-16-troubleshooting)

---

## Step 0: Prerequisites

Before starting, ensure you have:

| Requirement | Version | Download |
|-------------|---------|----------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Comes with Node.js |
| Git | Latest | [git-scm.com](https://git-scm.com) |
| MongoDB Atlas | Free tier | [mongodb.com](https://mongodb.com) |
| Vapi Account | Free ($10 credits) | [vapi.ai](https://vapi.ai) |
| Cloudflare Account | Free | [cloudflare.com](https://cloudflare.com) |
| Google Cloud | Free tier | [ai.google.dev](https://ai.google.dev) |
| Ngrok | Free tier | [ngrok.com](https://ngrok.com) |

Verify installations:

```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
git --version     # Should show 2.x.x or higher
ngrok --version   # Should show 3.x.x
```

---

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project folder
cd voiceforge

# You should see two folders:
# - voiceforge-api (backend)
# - voiceforge-web (frontend)
ls -la
```

---

## Step 2: MongoDB Setup

### 2.1 Create MongoDB Atlas Account

1. Go to [mongodb.com](https://mongodb.com) and click "Try Free"
2. Sign up with Google or email
3. Create a new organization if prompted

### 2.2 Create a Cluster

1. Click "Create" to start a new cluster
2. Choose "FREE" shared cluster
3. Select your nearest region (e.g., AWS / Mumbai for India)
4. Cluster name: `voiceforge`
5. Click "Create Cluster" (takes 1-2 minutes)

### 2.3 Configure Database Access

1. In left sidebar, click "Database Access"
2. Click "Add New Database User"
3. Authentication: Password
4. Username: `voiceforge_admin`
5. Password: Click "Autogenerate Secure Password" and **SAVE IT**
6. Database User Privileges: Read and write to any database
7. Click "Add User"

### 2.4 Configure Network Access

1. In left sidebar, click "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)
4. Or add your specific IP: `0.0.0.0/0`
5. Click "Confirm"

### 2.5 Get Connection String

1. Go back to "Clusters" (left sidebar)
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Driver: Node.js
5. Version: 4.1 or later
6. Copy the connection string

It looks like:
```
mongodb+srv://voiceforge_admin:<db_password>@cluster0.xxxxx.mongodb.net/voiceforge?retryWrites=true&w=majority
```

**Replace `<db_password>` with the password you saved.**

**Save this MongoDB URI - you'll need it in Step 9.**

---

## Step 3: Vapi Account Setup

### 3.1 Sign Up for Vapi

1. Go to [vapi.ai](https://vapi.ai)
2. Click "Get Started" or "Sign Up"
3. Sign up with email or Google
4. Complete onboarding

### 3.2 Get Your API Keys

1. Once logged in, go to [dashboard.vapi.ai](https://dashboard.vapi.ai)
2. Click your profile (top right) → "Account"
3. Go to "API Keys" tab
4. **Copy the Private Key** (starts with `pk_`)
5. Save this as `VAPI_API_KEY`

### 3.3 Get a Phone Number (Optional for Testing)

**Note:** You don't need a phone number for outbound campaigns. The app works without one.

If you want inbound calling:
1. Go to "Phone Numbers" in dashboard
2. Click "Buy Number"
3. Select country (e.g., United States)
4. Search by area code (optional)
5. Click "Buy" ($1-2/month, comes from your $10 free credits)

---

## Step 4: Gemini AI Setup

### 4.1 Get Gemini API Key

1. Go to [ai.google.dev](https://ai.google.dev)
2. Click "Get API key in Google AI Studio"
3. Sign in with Google
4. Click "Create API Key"
5. Select a project (or create new)
6. **Copy the API key**
7. Save this as `GEMINI_API_KEY`

### 4.2 Note the Model

We'll use: `gemini-2.5-flash` (fast and cost-effective)

---

## Step 5: Cloudflare R2 Setup

### 5.1 Create Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com)
2. Sign up for free account
3. Verify email

### 5.2 Create R2 Bucket

1. In Cloudflare dashboard, find "R2" in left sidebar
2. Click "Create bucket"
3. Bucket name: `voiceforge-uploads`
4. Location: Auto (or select your region)
5. Click "Create"

### 5.3 Get Account ID

1. On any R2 page, look at the URL: `https://dash.cloudflare.com/xxxxx/...`
2. The `xxxxx` is your Account ID
3. **Save this as `R2_ACCOUNT_ID`**

### 5.4 Create API Token

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Manage Account → API Tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Name: `VoiceForge R2 Access`
5. Permissions:
   - Account: Cloudflare R2: Read, Edit
   - User: User Details: Read
6. Account Resources: Include your account
7. Click "Continue to summary" → "Create Token"
8. **Copy the Token** (shown only once!)
9. **Save this as `R2_SECRET_ACCESS_KEY`**

### 5.5 Get Access Key ID

1. In R2 section, click "Manage R2 API Tokens"
2. Or go to R2 → Settings
3. Create an API token with "Object Read & Write" permissions
4. **Copy Access Key ID** as `R2_ACCESS_KEY_ID`

---

## Step 6: Backend Setup

### 6.1 Navigate to Backend

```bash
cd voiceforge-api
```

### 6.2 Install Dependencies

```bash
npm install
```

This installs all required packages:
- Express.js (web framework)
- Mongoose (MongoDB ODM)
- TypeScript (type safety)
- JWT (authentication)
- CSV parsing, file upload, and more

**If you get errors:**
- Make sure Node.js is v18+
- Try `npm install --legacy-peer-deps`

### 6.3 Create Environment File

```bash
cp .env.example .env
```

If `.env.example` doesn't exist, create `.env`:

```bash
touch .env
```

---

## Step 7: Frontend Setup

Open a **new terminal window/tab** (keep backend terminal open):

### 7.1 Navigate to Frontend

```bash
cd voiceforge-web
```

### 7.2 Install Dependencies

```bash
npm install
```

This installs:
- Next.js 14 (React framework)
- shadcn/ui components
- Tailwind CSS (styling)
- Zustand (state management)
- Axios (API client)

### 7.3 Create Environment File

```bash
touch .env.local
```

---

## Step 8: Ngrok Setup for Local Development

Ngrok creates a public URL that tunnels to your localhost. Vapi needs this to send webhooks to your local machine.

### 8.1 Install Ngrok

**macOS (using Homebrew):**
```bash
brew install ngrok
```

**Linux:**
```bash
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

**Windows:**
Download from [ngrok.com/download](https://ngrok.com/download) and add to PATH.

### 8.2 Sign Up and Get Authtoken

1. Go to [ngrok.com](https://ngrok.com) and sign up (free)
2. Verify email
3. Go to [dashboard.ngrok.com](https://dashboard.ngrok.com) → "Your Authtoken"
4. Copy your authtoken

### 8.3 Configure Ngrok

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

**Save your authtoken somewhere safe.**

### 8.4 Install Ngrok Node Package (Optional but Recommended)

In your project root:

```bash
npm install -g ngrok
```

---

## Step 9: Environment Configuration

This is the **most critical step**. Configure both `.env` files.

### 9.1 Backend `.env` File

Open `/voiceforge-api/.env` in your editor and add:

```env
# ============================================
# VoiceForge Backend Configuration
# ============================================

# Server Configuration
PORT=4000
NODE_ENV=development

# Your public API URL (will be filled after starting ngrok)
# For now, leave as localhost
API_PUBLIC_URL=http://localhost:4000

# ============================================
# Database (MongoDB)
# ============================================
# Replace <db_password> with your actual password
MONGODB_URI=mongodb+srv://voiceforge_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/voiceforge?retryWrites=true&w=majority

# ============================================
# Authentication
# ============================================
# Generate a random string (at least 32 characters)
# You can use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ============================================
# Vapi Configuration
# ============================================
# Your Vapi private API key (starts with pk_)
VAPI_API_KEY=pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook secret (generate random string)
VAPI_WEBHOOK_SECRET=your-webhook-secret-change-this

# ============================================
# Gemini AI Configuration
# ============================================
GEMINI_API_KEY=AIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-2.5-flash

# ============================================
# Cloudflare R2 Configuration
# ============================================
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=voiceforge-uploads

# Optional: Pinecone for RAG (advanced feature)
# PINECONE_API_KEY=your-pinecone-api-key
# PINECONE_INDEX=voiceforge
```

**Replace ALL placeholder values with your actual credentials.**

### 9.2 Frontend `.env.local` File

Open `/voiceforge-web/.env.local` and add:

```env
# ============================================
# VoiceForge Frontend Configuration
# ============================================

# Backend API URL
# For local development:
NEXT_PUBLIC_API_URL=http://localhost:4000

# For production, use your deployed backend URL:
# NEXT_PUBLIC_API_URL=https://api.voiceforge.app
```

---

## Step 10: Database Initialization

### 10.1 Start Backend in Dev Mode

In the `voiceforge-api` terminal:

```bash
npm run dev
```

You should see:
```
⚡ API on port 4000
Connected to MongoDB
```

### 10.2 Verify Database Connection

If you see "Connected to MongoDB", your database is working!

If you see an error:
- Check your `MONGODB_URI` in `.env`
- Make sure IP whitelist includes `0.0.0.0/0` in MongoDB Atlas
- Ensure the password is URL-encoded (replace special chars)

---

## Step 11: Vapi Dashboard Configuration

### 11.1 Start Ngrok

Open a **new terminal**:

```bash
ngrok http 4000
```

You should see:
```
Session Status                online
Account                       your@email.com (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Forwarding                    https://abc123-def.ngrok-free.app -> http://localhost:4000
```

**Copy the HTTPS URL** (e.g., `https://abc123-def.ngrok-free.app`)

### 11.2 Update Backend .env

1. Stop the backend (Ctrl+C)
2. Open `/voiceforge-api/.env`
3. Update `API_PUBLIC_URL`:

```env
API_PUBLIC_URL=https://abc123-def.ngrok-free.app
```

4. Restart backend:

```bash
npm run dev
```

### 11.3 Configure Vapi Assistant (If You Bought a Number)

**Only if you purchased a phone number ($1-2/month):**

1. Go to [dashboard.vapi.ai/phone-numbers](https://dashboard.vapi.ai/phone-numbers)
2. Click your phone number
3. Set **Server URL** to:
   ```
   https://abc123-def.ngrok-free.app/vapi/webhook
   ```
4. Set **Authorization** to:
   - Type: Bearer Token
   - Header: `x-vapi-secret`
   - Value: Your `VAPI_WEBHOOK_SECRET` from `.env`
5. Click "Save"

**Note:** You don't need this for outbound campaigns. Skip if you didn't buy a number.

---

## Step 12: Running the Application

You should now have **3 terminals running**:

| Terminal | Command | Purpose |
|----------|---------|---------|
| 1 | `cd voiceforge-api && npm run dev` | Backend API (port 4000) |
| 2 | `ngrok http 4000` | Public tunnel |
| 3 | `cd voiceforge-web && npm run dev` | Frontend (port 3000) |

### 12.1 Start Frontend

In the third terminal (voiceforge-web):

```bash
npm run dev
```

You should see:
```
➜  Local:   http://localhost:3000
➜  Network: http://192.168.x.x:3000
```

### 12.2 Open the Application

Go to [http://localhost:3000](http://localhost:3000)

You should see the VoiceForge login page!

---

## Step 13: Testing Your Setup

### 13.1 Run Verification Script

In a new terminal:

```bash
cd voiceforge-api
node verify-setup.js
```

You should see:
```
✅ Backend is running on port 4000
✅ Environment variables configured
✅ MongoDB connected
✅ All checks passed!
```

### 13.2 Create a Test User

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Sign Up" or "Create Account"
3. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
4. Click "Sign Up"

You should be redirected to the dashboard!

### 13.3 Test CSV Upload

Create a test CSV file named `test-contacts.csv`:

```csv
name,phone,notes
John Doe,+15551234567,Interested in demo
Jane Smith,+15559876543,Follow up next week
Bob Johnson,+15555678901,Hot lead
```

**Note:** For international numbers, include country code (e.g., `+91` for India).

---

## Step 14: Creating Your First Agent

### 14.1 Create Agent

1. In dashboard, click "Agents" → "New Agent"
2. Fill the form:

   **Basic Info:**
   - Name: "Sales Assistant"
   - Business Name: "Acme Corp"
   - Agent Type: Sales

   **Configuration:**
   - Language: English (en-US)
   - Tone: Professional
   - Description: "An AI sales assistant that qualifies leads and schedules demos"
   - Call Objective: "Book a product demo appointment"

   **Voice:**
   - Voice: Joseph (or any from dropdown)
   - Test the preview by clicking "Play"

3. Click "Deploy Agent"

### 14.2 Verify Agent Creation

- Check Vapi dashboard [dashboard.vapi.ai/assistants](https://dashboard.vapi.ai/assistants)
- You should see your agent listed!

---

## Step 15: Running Your First Campaign

### 15.1 Prepare CSV File

Create `campaign.csv`:

```csv
name,phone,notes
Test Contact,+15551234567,Test call for demo
```

**Important for international calls:** The system automatically detects international numbers and uses Vapi's platform number (free) instead of your Vapi number.

### 15.2 Create Campaign

1. Click "Campaigns" → "New Campaign"
2. Campaign Name: "Demo Campaign"
3. Select Agent: "Sales Assistant"
4. Upload your `campaign.csv`
5. Click "Upload"

### 15.3 Start Campaign

1. Click "Start Campaign"
2. The AI will start calling!
3. Watch the real-time status updates

### 15.4 Test for Free (Without Campaign)

**Option 1: "Talk to Assistant" Button**
1. Go to Vapi dashboard → Assistants
2. Click "Talk to Assistant"
3. Enter your phone number
4. Click "Call Me"
5. Vapi calls you - **FREE!**

**Option 2: Web Dashboard**
1. In VoiceForge dashboard, find your agent
2. Click "Test" or "Call"
3. Enter phone number
4. Click "Start Call"

---

## Step 16: Troubleshooting

### Issue: "MongoDB Connection Failed"

**Fix:**
1. Check `MONGODB_URI` in `.env`
2. Ensure password is URL-encoded (`@` becomes `%40`, etc.)
3. Add your IP to whitelist in MongoDB Atlas: `0.0.0.0/0`
4. Check network connection

### Issue: "Vapi API Error 401"

**Fix:**
1. Ensure `VAPI_API_KEY` is your **Private/Server key** (not Public key)
2. Private keys start with `pk_` but are labeled "Server"
3. Get correct key from [dashboard.vapi.ai](https://dashboard.vapi.ai) → Account → API Keys

### Issue: "Call Failed - International Calls"

**Fix:**
- This is expected with free Vapi numbers
- The code automatically handles this by not passing `phoneNumberId` for international calls
- Use "Talk to Assistant" button instead (free)
- Or upgrade Vapi account

### Issue: "Webhook Not Receiving Calls"

**Fix:**
1. Ensure ngrok is running: `ngrok http 4000`
2. Update `API_PUBLIC_URL` with fresh ngrok URL
3. Restart backend after `.env` changes
4. Check ngrok inspector: [http://127.0.0.1:4040](http://127.0.0.1:4040)

### Issue: "CSV Upload Fails"

**Fix:**
1. Check CSV format (must have `phone` column)
2. Supported column names: `phone`, `mobile`, `number`, `contact`, `tel`
3. Phone numbers should be valid (10+ digits)
4. Check browser console for errors

### Issue: "Voice Preview Not Working"

**Fix:**
- Voice previews are fetched from Vapi CDN
- Check browser console for CORS errors
- Try different voice

### Issue: "Build Fails"

**Fix:**
```bash
# Clean and reinstall
cd voiceforge-api
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 🎉 Success!

You've successfully set up VoiceForge! Here's what you can do now:

### Features Working:

✅ User authentication (JWT)
✅ AI agent creation with Vapi
✅ CSV contact upload
✅ Outbound calling campaigns
✅ International calling (via platform number)
✅ Call tracking and analytics
✅ Credit system
✅ Tool calling (time, appointments, etc.)

### Next Steps:

1. **Customize Agents** - Edit prompts, voices, behaviors
2. **Add Tools** - Implement custom functions in `/voiceforge-api/src/routes/vapi/tools.ts`
3. **Deploy** - Deploy backend to Railway/Render and frontend to Vercel
4. **Production** - Buy a Vapi number for inbound calls

### Deploy to Production:

**Backend (Railway/Render):**
1. Push code to GitHub
2. Connect Railway/Render to your repo
3. Add environment variables
4. Deploy

**Frontend (Vercel):**
1. Push code to GitHub
2. Import to Vercel
3. Set `NEXT_PUBLIC_API_URL` to your backend URL
4. Deploy

---

## 📚 Additional Resources

- **Vapi Docs:** [docs.vapi.ai](https://docs.vapi.ai)
- **Next.js Docs:** [nextjs.org/docs](https://nextjs.org/docs)
- **MongoDB Docs:** [docs.mongodb.com](https://docs.mongodb.com)
- **Gemini Docs:** [ai.google.dev](https://ai.google.dev)

---

## 💰 Cost Summary (Development)

| Service | Cost |
|---------|------|
| MongoDB Atlas | Free (512MB) |
| Vapi | $10 free credits |
| Cloudflare R2 | Free (10GB/month) |
| Gemini AI | Free tier (generous limits) |
| Ngrok | Free (with random URLs) |
| **TOTAL** | **$0** |

---

## 🆘 Need Help?

1. Check logs in terminal
2. Run `node verify-setup.js` in voiceforge-api
3. Review this guide's Troubleshooting section
4. Check Vapi dashboard logs

---

**You're all set! Start building with VoiceForge! 🚀**

