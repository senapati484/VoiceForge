# ⚙️ VoiceForge API - Backend

<p align="center">
  <img src="https://img.shields.io/badge/Express.js-4.x-404D59?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-7.0-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Vapi-API-5D3FD3?style=for-the-badge" />
</p>

Express.js backend API for VoiceForge AI Voice Agent Platform.

---

## 📁 Project Structure

```
voiceforge-api/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration & env vars
│   ├── routes/               # API route handlers
│   │   ├── auth.ts           # Authentication routes
│   │   ├── agents.ts         # Agent CRUD
│   │   ├── campaigns.ts      # Campaign management
│   │   ├── call-logs.ts      # Call history
│   │   ├── voices.ts         # Voice library
│   │   ├── credits.ts        # Credit system
│   │   ├── knowledge.ts      # RAG knowledge base
│   │   ├── llm.ts            # Gemini LLM proxy
│   │   └── vapi/             # Vapi integration
│   │       ├── webhook.ts    # Vapi webhook handler
│   │       └── tools.ts      # Tool definitions
│   │
│   ├── services/             # Business logic
│   │   ├── vapi.service.ts       # Vapi API integration
│   │   ├── campaign.service.ts   # CSV + Campaign logic
│   │   ├── r2.service.ts         # Cloudflare R2 storage
│   │   ├── contextBuilder.service.ts # AI context building
│   │   └── credit.service.ts     # Credit management
│   │
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts           # JWT authentication
│   │   ├── error.ts          # Error handling
│   │   └── upload.ts         # File upload handling
│   │
│   ├── db/                   # Database
│   │   ├── mongoose.ts       # DB connection
│   │   └── models/           # Mongoose models
│   │       ├── User.ts
│   │       ├── Agent.ts
│   │       ├── Campaign.ts
│   │       ├── CsvContact.ts
│   │       ├── CallLog.ts
│   │       └── CreditLog.ts
│   │
│   ├── validators/           # Input validation (Zod)
│   │   ├── auth.validator.ts
│   │   ├── agent.validator.ts
│   │   └── campaign.validator.ts
│   │
│   └── types/                # TypeScript types
│       └── index.ts
│
├── dist/                     # Compiled JavaScript (build output)
├── .env                      # Environment variables
├── .env.example              # Example environment file
├── tsconfig.json             # TypeScript config
├── package.json
└── verify-setup.js           # Setup verification script
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas account
- Vapi account

### Installation

```bash
# Clone repository
git clone <repository-url>
cd voiceforge/voiceforge-api

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Environment Variables

Add to `.env`:

```env
# Server
PORT=4000
NODE_ENV=development
API_PUBLIC_URL=http://localhost:4000

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/voiceforge?retryWrites=true&w=majority

# Auth
JWT_SECRET=your-super-secret-jwt-key

# Vapi
VAPI_API_KEY=pk_your_vapi_server_key
VAPI_WEBHOOK_SECRET=your_webhook_secret

# Gemini AI
GEMINI_API_KEY=AI_your_gemini_key
GEMINI_MODEL=gemini-2.5-flash

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=voiceforge-uploads
```

### Run Development Server

```bash
npm run dev
```

API available at `http://localhost:4000`

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run compiled production server |
| `npm run migrate:user-context` | Run user context migration |

---

## 🏗️ Architecture

### Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.x
- **Language:** TypeScript 5.x
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** Zod
- **File Storage:** Cloudflare R2
- **AI Integration:** Vapi + Gemini

### Request Flow

```
Client Request → Middleware → Route Handler → Service → Database
                     ↓              ↓              ↓
                JWT Auth      Validation    Business Logic
                CORS          Rate Limit    External APIs
```

---

## 🔐 Authentication

### JWT Implementation

```typescript
// middleware/auth.ts
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Token Storage

- Tokens stored in HTTP-only cookies
- Frontend sends cookies automatically with requests
- CORS configured to allow credentials

---

## 🗄️ Database Models

### User Model

```typescript
interface IUser {
  email: string;
  password: string;      // Hashed with bcrypt
  name: string;
  credits: number;       // Default: 10
  role: 'user' | 'admin';
  createdAt: Date;
}
```

### Agent Model

```typescript
interface IAgent {
  userId: ObjectId;
  name: string;
  businessName: string;
  agentType: 'marketing' | 'support' | 'sales' | 'tech';
  language: string;
  voiceId: string;
  description: string;
  callObjective: string;
  vapiAgentId: string;     // Vapi assistant ID
  phoneNumber?: string;    // Assigned Vapi number
  isActive: boolean;
}
```

### Campaign Model

```typescript
interface ICampaign {
  userId: ObjectId;
  agentId: ObjectId;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  totalContacts: number;
  csvR2Key: string;        // R2 file location
  startedAt?: Date;
  completedAt?: Date;
}
```

### CsvContact Model

```typescript
interface ICsvContact {
  campaignId: ObjectId;
  userId: ObjectId;
  name: string;
  phone: string;           // E.164 format
  notes?: string;
  status: 'pending' | 'calling' | 'completed' | 'failed';
  callResult?: string;
  callDuration?: number;
  transcript?: string;
}
```

---

## 📡 API Routes

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |

### Agents

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/agents` | List user's agents |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/:id` | Get agent details |
| PATCH | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |

### Campaigns

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id` | Get campaign |
| POST | `/api/campaigns/:id/start` | Start campaign |
| POST | `/api/campaigns/:id/pause` | Pause campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Vapi Webhook

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/vapi/webhook` | Receive Vapi events |

### Other Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/voices` | List available voices |
| GET | `/api/call-logs` | Get call history |
| GET | `/api/credits` | Get credit balance |
| POST | `/api/knowledge/upload` | Upload knowledge document |

---

## 🤖 Vapi Integration

### Webhook Events Handled

1. **assistant-request** - Returns assistant config for inbound calls
2. **tool-calls** - Executes custom functions
3. **status-update** - Call status changes
4. **end-of-call-report** - Call completion & credit deduction
5. **conversation-update** - Real-time conversation updates

### Tool System

Built-in tools available to AI agents:

```typescript
// tools.ts
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getCurrentTime',
      description: 'Get current date and time',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lookupCustomer',
      description: 'Look up customer by phone',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number' }
        },
        required: ['phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bookAppointment',
      description: 'Book an appointment',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          time: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['date', 'time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sendSMS',
      description: 'Send SMS message',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['to', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'transferToHuman',
      description: 'Transfer to human agent',
      parameters: { type: 'object', properties: {} }
    }
  }
];
```

---

## 📊 Campaign Service

### CSV Parsing Features

- **Flexible columns** - Detects `phone`, `mobile`, `number`, etc.
- **Auto delimiter** - Supports comma and semicolon
- **Headerless CSV** - Works with and without headers
- **Phone normalization** - Converts to E.164 format
- **International support** - Detects country codes

### Phone Normalization

```typescript
// Example conversions:
"+1 (555) 123-4567"   → "+15551234567"
"555-123-4567"        → "+15551234567"
"+91 98765 43210"     → "+919876543210"
"+44 20 7946 0958"    → "+442079460958"
```

### International Calling

The system automatically detects international calls and uses Vapi's platform number instead of your free Vapi number (which doesn't support international calls).

```typescript
// In campaign.service.ts
const isInternational = isLikelyInternational(contact.phone, agent.phoneNumber);

await triggerOutboundCall(
  agent.vapiAgentId,
  contact.phone,
  metadata,
  isInternational ? undefined : agent.phoneNumberId
);
```

---

## ☁️ Cloudflare R2 Storage

### File Operations

```typescript
// services/r2.service.ts

// Upload file
await uploadToR2(key, buffer, contentType);

// Generate signed URL
const url = await getSignedUrl(key, expiresIn);

// Delete file
await deleteFromR2(key);
```

### Campaign CSV Storage

CSV files are stored in R2 at path:
```
campaigns/{userId}/{timestamp}.csv
```

---

## 🔧 Development Guide

### Adding a New Route

1. Create route file: `src/routes/new-feature.ts`
2. Add to `src/index.ts`:

```typescript
import newFeatureRoutes from './routes/new-feature';
app.use('/api/new-feature', authenticate, newFeatureRoutes);
```

### Adding a Model

1. Create model: `src/db/models/NewModel.ts`
2. Export from `src/db/index.ts`:

```typescript
export { default as NewModel } from './models/NewModel';
```

### Adding Middleware

1. Create middleware: `src/middleware/new-middleware.ts`
2. Apply in `src/index.ts`:

```typescript
app.use(newMiddleware);
```

---

## 🐛 Debugging

### Common Issues

**"Cannot find module"**
```bash
# Rebuild TypeScript
npm run build
```

**"MongoDB connection failed"**
- Check `MONGODB_URI` in `.env`
- Ensure IP whitelist includes `0.0.0.0/0`
- Verify password is URL-encoded

**"Vapi API error 401"**
- Ensure using **Private/Server key** (not Public key)
- Private keys start with `pk_` but are labeled "Server"

**"TypeScript compilation errors"**
```bash
# Check TypeScript
npx tsc --noEmit

# Fix errors and rebuild
npm run build
```

### Logs

The API uses Morgan for request logging:

```
GET /api/agents 200 45ms - 2.3kb
POST /api/campaigns 201 123ms - 456b
```

Vapi webhook events are logged with prefix `[Vapi Webhook]`.

---

## 📦 Build & Deploy

### Production Build

```bash
# Compile TypeScript
npm run build

# Run compiled code
npm start
```

### Deploy to Railway

1. Push to GitHub
2. Create Railway project
3. Connect to GitHub repo
4. Add environment variables
5. Deploy

### Deploy to Render

1. Push to GitHub
2. Create new Web Service on Render
3. Connect to repo
4. Set build command: `npm run build`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy

---

## 📝 TypeScript Configuration

Key settings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 📚 Resources

- [Express.js Docs](https://expressjs.com/en/4x/api.html)
- [Mongoose Docs](https://mongoosejs.com/docs/)
- [Vapi Docs](https://docs.vapi.ai)
- [Gemini AI Docs](https://ai.google.dev/docs)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)

---

<p align="center">
  Built with ⚡ using Express.js, TypeScript, and MongoDB
</p>
