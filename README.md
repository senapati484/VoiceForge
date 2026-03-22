# 🎙️ VoiceForge - AI Voice Agent Platform 

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Vapi-5D3FD3?style=for-the-badge" />
</p>

## 🌟 Overview 

VoiceForge is a complete AI Voice Agent platform that enables businesses to create intelligent voice assistants for both **inbound** (receiving calls) and **outbound** (making calls) scenarios. Built with modern tech stack including Next.js, Express, MongoDB, and Vapi.

### Key Features

🤖 **AI Voice Agents** - Create custom AI agents with different personalities (marketing, support, sales, tech)
📞 **Outbound Campaigns** - Upload CSV contacts and trigger AI-powered calling campaigns
📲 **Inbound Calling** - Receive calls on your Vapi number with AI answering
🌍 **International Calling** - Call any country's numbers globally
🎙️ **Voice Selection** - Choose from multiple AI voices with previews
📊 **Campaign Analytics** - Track call status, duration, transcripts
🔧 **Custom Tools** - AI can execute functions (book appointments, send SMS, etc.)
💳 **Credit System** - Built-in credit management for usage tracking
⭐️ **Just Give a Star⭐️** if you like it ;)

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │    Backend      │      │   External      │
│   (Next.js)     │◄────►│   (Express)     │◄────►│   Services      │
│                 │      │                 │      │                 │
│ • Dashboard     │      │ • REST API      │      │ • Vapi.ai       │
│ • Campaigns     │      │ • Webhooks      │      │ • MongoDB       │
│ • Agents        │      │ • CSV Parser    │      │ • Cloudflare R2 │
│ • Auth          │      │ • Credit System │      │ • Gemini AI     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 📁 Project Structure

```
voiceforge/
├── voiceforge-web/          # Frontend (Next.js 14)
│   ├── app/                 # Next.js App Router
│   │   ├── dashboard/       # Dashboard pages
│   │   │   ├── agents/      # Agent management
│   │   │   ├── campaigns/   # Campaign management
│   │   │   └── settings/    # User settings
│   │   ├── api/             # API routes
│   │   └── layout.tsx       # Root layout
│   ├── components/          # React components
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                 # Utilities
│   │   ├── api.ts           # API client
│   │   └── types/           # TypeScript types
│   └── store/               # Zustand state management
│
└── voiceforge-api/          # Backend (Express + TypeScript)
    ├── src/
    │   ├── routes/          # API routes
    │   │   ├── vapi/        # Vapi webhook handlers
    │   │   │   ├── webhook.ts    # Main webhook handler
    │   │   │   └── tools.ts      # Tool definitions
    │   │   ├── agents.ts    # Agent CRUD
    │   │   ├── campaigns.ts # Campaign management
    │   │   └── auth.ts      # Authentication
    │   ├── services/        # Business logic
    │   │   ├── campaign.service.ts   # CSV + Campaign logic
    │   │   ├── vapi.service.ts       # Vapi integration
    │   │   └── contextBuilder.service.ts  # AI context
    │   ├── db/              # Database
    │   │   ├── models/      # Mongoose models
    │   │   └── mongoose.ts  # DB connection
    │   ├── middleware/      # Express middleware
    │   ├── validators/      # Input validation
    │   └── index.ts         # Entry point
    └── .env                 # Environment variables
```

---


## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (free)
- Vapi account (free $10 credits)
- Cloudflare R2 account (free tier)
- Google Gemini API key (free)

### 1. Clone Repository

```bash
git clone https://github.com/senapati484/VoiceForge.git
cd voiceforge
```

### 2. Setup Backend

```bash
cd voiceforge-api
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### 3. Setup Frontend

```bash
cd voiceforge-web
npm install
npm run dev
```

### 4. Configure Environment Variables

**Backend `.env`:**
```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-super-secret-key

# Vapi Credentials
VAPI_API_KEY=your-vapi-server-key
VAPI_WEBHOOK_SECRET=your-webhook-secret

# Ngrok (for local development)
API_PUBLIC_URL=https://your-ngrok-url.ngrok-free.app

# Gemini AI
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Optional: Pinecone for RAG
PINECONE_API_KEY=...
PINECONE_INDEX=...
```

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 📚 Documentation

### Quick Start
- **[Complete Setup Guide](VOICEFORGE_COMPLETE_GUIDE.md)** ⭐ - Complete 0 to 100 guide for setting up everything
- **[Vapi Dashboard Setup](docs/VAPI_DASHBOARD_SETUP.md)** - Configure Vapi webhooks for calling
- **[Ngrok Setup](docs/NGROK_VAPI_SETUP.md)** - Local development tunneling setup

### Project Docs
- **[Frontend README](voiceforge-web/README.md)** - Next.js frontend documentation
- **[Backend README](voiceforge-api/README.md)** - Express.js backend documentation
- **[Troubleshooting](docs/VOICEFORGE_TROUBLESHOOTING.md)** - Common issues and fixes

### Environment Templates
- **[Backend .env.example](voiceforge-api/.env.example)** - Backend environment variables
- **[Frontend .env.example](voiceforge-web/.env.example)** - Frontend environment variables

---

### Visual Demo(pages)
<img width="1710" height="986" alt="Home-Page" src="https://github.com/user-attachments/assets/732c9ddd-ac10-493e-9c85-a5052f000c6b" />
<img width="1710" height="986" alt="Agent-Page" src="https://github.com/user-attachments/assets/4d39b3d9-199b-4220-a819-f907e7e97e2d" />
<img width="1710" height="986" alt="Knoledge-Page" src="https://github.com/user-attachments/assets/7885e188-dc5f-439a-a4d7-bc611538029d" />
<img width="1710" height="985" alt="Pricing-Page" src="https://github.com/user-attachments/assets/a7a3b7fb-9aa5-4967-8f8d-6fa6e45557bf" />

## 🎯 Core Workflows

### Creating an AI Agent

1. Go to Dashboard → Agents → New
2. Select agent type (marketing/support/sales/tech)
3. Configure:
   - Name & Business Name
   - Language & Tone
   - Description & Call Objective
   - Voice (with preview)
4. Deploy - Creates Vapi assistant automatically


### Running Outbound Campaign

1. Create Campaign → Select Agent
2. Upload CSV with contacts:
   ```csv
   name,phone,notes
   John Doe,+15551234567,Interested in demo
   ```
3. Click "Start Campaign"
4. AI calls each contact automatically
5. Monitor progress in dashboard

### Receiving Inbound Calls

1. Buy phone number in Vapi dashboard
2. Link to your agent
3. Configure webhook URL
4. Give number to customers
5. AI answers when they call

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Zustand** - State management
- **SWR** - Data fetching

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **MongoDB + Mongoose** - Database
- **Vapi SDK** - Voice AI integration
- **Gemini AI** - LLM for responses
- **Cloudflare R2** - File storage
- **Pinecone** - Vector database (optional)

---

## 🔐 Authentication

- JWT-based authentication
- Secure HTTP-only cookies
- Protected API routes
- Session management

---

## 💰 Pricing

### Development (Free)
- Vapi: $10 free credits
- MongoDB: Free tier
- Cloudflare R2: Free tier
- Gemini: Free tier
- Ngrok: Free tier

### Production (Estimated)
- Vapi number: $1-2/month
- Calls: $0.05-0.15/minute
- MongoDB: $5-10/month
- Hosting: $5-20/month

---

## 🧪 Testing

```bash
# Backend
cd voiceforge-api
npm run test

# Frontend
cd voiceforge-web
npm run test
```

---

## 📦 Deployment

### Backend (Railway/Render/AWS)
```bash
# Build
npm run build

# Start production
npm start
```

### Frontend (Vercel/Netlify)
```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📝 License

MIT License - see LICENSE file

---

## 🙏 Acknowledgments

- [Vapi](https://vapi.ai) - Voice AI platform
- [Gemini](https://ai.google.dev) - Google's AI model
- [shadcn/ui](https://ui.shadcn.com) - UI component library
- [Next.js](https://nextjs.org) - React framework

---

## 📞 Support

- Documentation: See `/docs` folder
- Issues: Create GitHub issue
- Email: support@voiceforge.ai

---

<p align="center">
  <strong>Built with ❤️ for AI-powered voice communication</strong>
</p>
