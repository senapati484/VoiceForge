# VoiceForge Workspace

VoiceForge is an AI voice agent platform split into a Next.js frontend and an Express/TypeScript backend. It supports OTP and Google sign-in, agent management, knowledge ingestion, outbound calling, campaign workflows, credit tracking, Cloudflare R2 storage, Pinecone-backed retrieval, and Vapi call orchestration.

This root README is the entrypoint for the full workspace. Use it to understand the project layout, local setup, and where the deeper docs live.

## Workspace Overview

### Main Apps

- `voiceforge-web`: Next.js 16 frontend with App Router, NextAuth, Zustand, Axios, and shadcn/ui components.
- `voiceforge-api`: Express 5 + TypeScript backend with MongoDB, Zod validation, Cloudflare R2 uploads, Pinecone retrieval, Vapi integrations, and a background worker.
- `docs`: Supporting project docs and HTML exports.

### High-Level Architecture

- Frontend: `voiceforge-web` renders the landing page, login flow, dashboard, agents, calls, campaigns, billing, and knowledge screens.
- Authentication: the frontend uses NextAuth for session handling and exchanges credentials or Google OAuth with backend auth endpoints.
- Backend API: `voiceforge-api` exposes REST endpoints for auth, agents, voices, knowledge, credits, calls, campaigns, and health checks.
- Data layer: MongoDB stores users, agents, calls, campaigns, credits, and knowledge document metadata.
- Knowledge pipeline: uploaded files or scraped content are stored in Cloudflare R2, then processed by a worker and indexed into Pinecone for retrieval.
- Voice operations: Vapi powers outbound calls and webhook-driven call updates.

## Repo Structure

```text
BinaryV2/
├── docs/
├── voiceforge-api/
└── voiceforge-web/
```

- `docs/OAUTH_SETUP.md`: OAuth-specific setup notes.
- `docs/VoiceAgentPlatform_Docs.html`: exported project documentation.
- `docs/VoiceForge_Final_Playbook.html`: playbook-style reference doc.
- `docs/VoiceForgev1.html`: additional exported product/project notes.
- `voiceforge-api/src`: backend entrypoints, routes, middleware, services, validators, worker, and database code.
- `voiceforge-api/POSTMAN_TESTING_GUIDE.md`: backend testing flow and endpoint walkthrough.
- `voiceforge-web/app`: App Router pages including login, landing page, and dashboard sections.
- `voiceforge-web/components`: reusable UI and dashboard components.
- `voiceforge-web/lib`: API client, auth config, shared types, and utility helpers.
- `voiceforge-web/store`: Zustand stores for client state.

## Local Setup

### Prerequisites

- Node.js 20+ recommended
- npm
- MongoDB connection
- Cloudflare R2 bucket and credentials
- Pinecone index
- Vapi account credentials
- SMTP credentials for OTP email delivery
- Google OAuth credentials if you want Google sign-in

### 1. Install Dependencies

Install each app separately:

```bash
cd voiceforge-api
npm install
```

```bash
cd voiceforge-web
npm install
```

### 2. Configure Environment Files

Backend:

- Copy values from `voiceforge-api/.env.example` into `voiceforge-api/.env`.
- Do not commit real secrets from `voiceforge-api/.env`.

Frontend:

- Create `voiceforge-web/.env.local` for local frontend configuration.
- Do not commit real secrets from `voiceforge-web/.env.local`.

### 3. Start the Backend

```bash
cd voiceforge-api
npm run dev
```

Default backend URL: `http://localhost:4000`

The API also starts a background worker that checks pending knowledge documents and ingests them into Pinecone.

### 4. Start the Frontend

```bash
cd voiceforge-web
npm run dev
```

Default frontend URL: `http://localhost:3000`

## Environment Summary

### Backend Environment

The backend hard-fails on missing required variables. The source of truth is [`voiceforge-api/.env.example`](voiceforge-api/.env.example).

Important backend variables include:

- App: `PORT`, `NODE_ENV`, `FRONTEND_URL`, `API_PUBLIC_URL`
- Database and auth: `MONGODB_URI`, `JWT_SECRET`
- LLM and embeddings: `SMOLIFY_API_KEY`, `SMOLIFY_MODEL`, `GEMINI_API_KEY`
- Storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- Alternate storage key support: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_S3_API`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL`, `AWS_REGION`
- Voice/call orchestration: `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET`
- Retrieval: `PINECONE_API_KEY`, `PINECONE_INDEX`
- Email OTP: `SMTP_USER`, `SMTP_PASS`
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Frontend Environment

The frontend code currently reads these variables:

- `API_URL`: server-side API base URL used by NextAuth and dashboard data fetching
- `NEXT_PUBLIC_API_URL`: browser-side API base URL used by the Axios client
- `GOOGLE_CLIENT_ID`: Google provider client ID for NextAuth
- `GOOGLE_CLIENT_SECRET`: Google provider client secret for NextAuth
- Standard NextAuth deployment variables may also be needed depending on how you run it locally or in production

Recommended local defaults:

- `API_URL=http://localhost:4000`
- `NEXT_PUBLIC_API_URL=http://localhost:4000/api`

## Developer Commands

### `voiceforge-api`

- `npm run dev`: run the backend with `ts-node-dev`
- `npm run build`: compile TypeScript to `dist`
- `npm start`: start the compiled backend from `dist/index.js`

### `voiceforge-web`

- `npm run dev`: start the Next.js dev server
- `npm run build`: create a production build
- `npm start`: run the production server
- `npm run lint`: run ESLint

## Backend Surface Area

The backend currently exposes these main route groups:

- `/health`
- `/api/auth`
- `/api/agents`
- `/api/calls`
- `/api/knowledge`
- `/api/credits`
- `/api/voices`
- `/api/campaigns`

Common flows already supported in the codebase:

- Email OTP sign-in and Google sign-in
- Agent creation and management
- Knowledge upload and URL scraping
- Background ingestion into Pinecone
- Credits lookup and purchase flow
- Outbound calling and call history
- Campaign creation and execution

## Useful Docs

- [Backend Postman Testing Guide](voiceforge-api/POSTMAN_TESTING_GUIDE.md)
- [OAuth Setup](docs/OAUTH_SETUP.md)
- [Voice Agent Platform Docs](docs/VoiceAgentPlatform_Docs.html)
- [VoiceForge Final Playbook](docs/VoiceForge_Final_Playbook.html)
- [VoiceForge v1 Notes](docs/VoiceForgev1.html)

## Notes

- This project is documented here as a single workspace/codebase.
- Git metadata currently exists at `voiceforge-web/.git`, while the workspace root itself is not initialized as a Git repo yet.
- The root `.gitignore` becomes the active ignore policy once Git is initialized at the workspace root.
- Existing subproject docs such as `voiceforge-web/README.md` remain in place for app-specific details.
