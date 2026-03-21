# 🎨 VoiceForge Web - Frontend

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-1.0-000000?style=for-the-badge" />
</p>

Modern React frontend for VoiceForge AI Voice Agent Platform.

---

## 📁 Project Structure

```
voiceforge-web/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes (auth, etc.)
│   ├── dashboard/            # Dashboard pages
│   │   ├── agents/           # Agent management
│   │   ├── campaigns/        # Campaign management
│   │   ├── call-logs/        # Call history
│   │   ├── knowledge/        # RAG knowledge base
│   │   ├── analytics/        # Analytics dashboard
│   │   ├── credits/          # Credit management
│   │   └── settings/         # User settings
│   ├── login/                # Authentication pages
│   ├── register/
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Landing page
│   └── globals.css           # Global styles
│
├── components/               # React components
│   ├── ui/                   # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── agents/               # Agent-specific components
│   ├── campaigns/            # Campaign components
│   ├── layout/               # Layout components
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── navbar.tsx
│   └── ...
│
├── lib/                      # Utilities & configs
│   ├── api.ts                # API client (axios)
│   ├── utils.ts              # Helper functions
│   └── types/                # TypeScript types
│       ├── agent.ts
│       ├── campaign.ts
│       ├── user.ts
│       └── ...
│
├── store/                    # Zustand state management
│   ├── auth-store.ts         # Auth state
│   ├── agent-store.ts        # Agent state
│   └── campaign-store.ts     # Campaign state
│
├── public/                   # Static assets
├── hooks/                    # Custom React hooks
├── middleware.ts             # Next.js middleware (auth)
├── next.config.ts            # Next.js config
├── tailwind.config.ts        # Tailwind config
├── tsconfig.json             # TypeScript config
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Backend running on `http://localhost:4000`

### Installation

```bash
# Clone repository
git clone <repository-url>
cd voiceforge/voiceforge-web

# Install dependencies
npm install

# Create environment file
touch .env.local
```

### Environment Variables

Add to `.env.local`:

```env
# Backend API URL (required)
NEXT_PUBLIC_API_URL=http://localhost:4000

# For production, use deployed backend:
# NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 🏗️ Architecture

### Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI Components:** shadcn/ui
- **State Management:** Zustand
- **Data Fetching:** SWR + Axios
- **Auth:** JWT (stored in cookies)
- **Notifications:** Sonner (toast)

### Key Features

- **App Router** - Modern Next.js routing with layouts
- **Server Components** - Default server-side rendering
- **Client Components** - Interactive parts with 'use client'
- **Middleware** - Auth protection at edge
- **Type Safety** - Full TypeScript coverage
- **Dark Mode** - Built-in theme support

---

## 🔐 Authentication Flow

```
Login Page → API Call → JWT Token → Cookie Storage
                              ↓
                    Middleware Check → Protected Routes
```

### Protected Routes

All `/dashboard/*` routes require authentication. The middleware (`middleware.ts`) automatically:

1. Checks for valid JWT token
2. Redirects to `/login` if not authenticated
3. Passes user data to server components

### Auth Store (Zustand)

```typescript
// stores/auth-store.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}
```

---

## 🎨 UI Components

### shadcn/ui Components Used

- **Button** - Actions and navigation
- **Card** - Content containers
- **Dialog** - Modals and popups
- **Form** - Form validation with React Hook Form
- **Input** - Text inputs
- **Select** - Dropdown selections
- **Table** - Data display
- **Toast** - Notifications (Sonner)
- **Sheet** - Mobile sidebars
- **Dropdown Menu** - Navigation menus
- **Tabs** - Content organization
- **Avatar** - User profile images
- **Badge** - Status indicators
- **Progress** - Loading states

### Custom Components

- **Sidebar** - Dashboard navigation
- **Header** - Top bar with user menu
- **DataTable** - Reusable table with sorting/filtering
- **FileUpload** - CSV upload with drag-and-drop
- **VoicePlayer** - Voice preview player
- **CampaignStatus** - Real-time status indicator

---

## 📡 API Integration

### API Client

```typescript
// lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,  // For cookies
});

// Request interceptor for auth
api.interceptors.request.use((config) => {
  // Add auth headers if needed
  return config;
});

// Response interceptor for errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Data Fetching with SWR

```typescript
// hooks/useAgents.ts
import useSWR from 'swr';
import { api } from '@/lib/api';

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/agents',
    (url) => api.get(url).then(res => res.data)
  );

  return {
    agents: data,
    isLoading,
    error,
    refresh: mutate
  };
}
```

---

## 📄 Page Structure

### Public Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with features |
| `/login` | User login |
| `/register` | User registration |

### Protected Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard |
| `/dashboard/agents` | List all agents |
| `/dashboard/agents/new` | Create new agent |
| `/dashboard/agents/[id]` | Edit agent |
| `/dashboard/campaigns` | List all campaigns |
| `/dashboard/campaigns/new` | Create new campaign |
| `/dashboard/campaigns/[id]` | View campaign details |
| `/dashboard/call-logs` | Call history |
| `/dashboard/knowledge` | Knowledge base (RAG) |
| `/dashboard/analytics` | Analytics dashboard |
| `/dashboard/credits` | Credit management |
| `/dashboard/settings` | User settings |

---

## 🧩 State Management

### Zustand Stores

```typescript
// Example: Agent Store
interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoading: boolean;

  // Actions
  fetchAgents: () => Promise<void>;
  createAgent: (data: AgentData) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<AgentData>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setCurrentAgent: (agent: Agent | null) => void;
}
```

---

## 🎨 Styling Guide

### Tailwind Classes

```css
/* Layout */
.container - Max-width container
.flex, .grid - Layout systems
.gap-4 - Spacing between items
.p-4, .m-4 - Padding and margin

/* Typography */
.text-sm, .text-base, .text-lg, .text-xl - Font sizes
.font-medium, .font-bold - Font weights
.text-gray-500, .text-primary - Colors

/* Components */
.btn - Base button styles
.card - Card container
.input - Form inputs
```

### Theme Colors

```css
/* Primary colors */
--primary: #5D3FD3;        /* Vapi purple */
--primary-foreground: #FFFFFF;

/* Background */
--background: #FFFFFF;      /* Light mode */
--background: #0A0A0A;      /* Dark mode */

/* Accents */
--accent: #F1F5F9;
--muted: #F8FAFC;
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Width | Description |
|------------|-------|-------------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

---

## 🔧 Development Tips

### Adding a New Page

1. Create file: `app/dashboard/new-page/page.tsx`
2. Add to sidebar: `components/layout/sidebar.tsx`
3. Create API hook if needed

### Adding a Component

```bash
# shadcn/ui component
npx shadcn add button

# Or custom component
# Create in components/
```

### Adding an API Call

1. Add type to `lib/types/`
2. Add API function to `lib/api.ts` or store
3. Use in component with SWR or direct call

---

## 🐛 Debugging

### Common Issues

**"Cannot find module"**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

**"API connection refused"**
- Check backend is running on port 4000
- Verify `NEXT_PUBLIC_API_URL` in `.env.local`

**"CORS error"**
- Backend must allow requests from `http://localhost:3000`
- Check backend CORS configuration

**"TypeScript errors"**
```bash
# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

---

## 📦 Build & Deploy

### Production Build

```bash
# Set production API URL in .env.local
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Build
npm run build

# Start
npm run start
```

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

**Vercel Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

---

## 📝 File Naming Conventions

- **Components:** PascalCase (`AgentCard.tsx`)
- **Pages:** camelCase (`page.tsx`)
- **Layouts:** `layout.tsx`
- **Hooks:** camelCase with `use` prefix (`useAgents.ts`)
- **Utils:** camelCase (`formatDate.ts`)
- **Types:** PascalCase with type (`Agent.ts`, `Campaign.ts`)

---

## 🎯 Key Features Implementation

### CSV Upload

- Uses `react-dropzone` for drag-and-drop
- Validates file type (CSV only)
- Shows upload progress
- Parses on backend

### Voice Preview

- Fetches from Vapi CDN
- Uses HTML5 Audio API
- Shows loading state
- Error handling for unavailable voices

### Real-time Campaign Status

- Polls campaign status every 5 seconds
- Shows progress bar
- Updates contact status in real-time
- Toast notifications for completion

---

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind Docs](https://tailwindcss.com)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [SWR Docs](https://swr.vercel.app)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing`
5. Open Pull Request

---

<p align="center">
  Built with ❤️ using Next.js, Tailwind CSS, and shadcn/ui
</p>
