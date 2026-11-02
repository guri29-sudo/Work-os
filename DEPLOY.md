# Deployment Guide: WorkOS Internal Communication System

This guide contains **only** the manual steps required to deploy the system to production and the environment variables you need to configure.

---

## 1. Managed PostgreSQL Setup (Neon or Render)

1. Create a PostgreSQL 16+ database instance (recommended: [Neon](https://neon.tech) or [Render PostgreSQL](https://render.com)).
2. Copy your connection string (`postgres://...`).
3. Ensure SSL is enabled (`?sslmode=require`).

---

## 2. Backend Deployment (Render)

The backend provides the REST API, WebSocket gateway, `/health` probes, and the built-in demo IdP / JWKS provider on the same service.

1. Connect your repository to [Render](https://render.com) as a **Web Service** (or use the included `render.yaml` blueprint).
2. Configure settings:
   - **Root Directory**: `.` (monorepo root)
   - **Build Command**:
     ```bash
     pnpm install && pnpm --filter @cs/contracts build && pnpm --filter @cs/test-fixtures build && pnpm --filter @cs/api build
     ```
   - **Start Command**:
     ```bash
     pnpm --filter @cs/api start
     ```
   - **Health Check Path**: `/health`
3. Set the following Environment Variables in the Render dashboard:

| Environment Variable | Value / Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | `production` |
| `PORT` | `10000` | `10000` |
| `DATABASE_URL` | Your managed PostgreSQL connection string | `postgres://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `CORS_ORIGIN` | Your Vercel frontend URL (from step 3) | `https://your-workos-app.vercel.app` |
| `JWT_ISSUER` | Your Render API URL | `https://workos-api.onrender.com` |
| `JWKS_URL` | Your Render API JWKS endpoint | `https://workos-api.onrender.com/.well-known/jwks.json` |
| `JWT_AUDIENCE` | Token audience | `communication-system` |
| `WEBHOOK_SIGNING_SECRET` | 32+ character random secret string | *(generate a random string)* |
| `RATE_LIMIT_MAX` | Max requests per minute | `200` |
| `RATE_LIMIT_WINDOW_MS` | Window in milliseconds | `60000` |
| `STORAGE_BUCKET` | Attachments bucket name | `cs-attachments` |
| `STORAGE_REGION` | Storage region | `us-east-1` |

---

## 3. Remote Database Migration & Seeding

Run the schema migrations and the idempotent seed against your remote database from your local machine:

```powershell
# In PowerShell (replace with your remote connection string):
$env:MIGRATION_DATABASE_URL = "postgres://user:password@host/dbname?sslmode=require"
pnpm db:migrate
pnpm db:seed
```

The seed script will print the 4 seeded demo accounts at completion:
* **Company 1 Admin**: `rohan@company.com` (`AdminPassword123!`)
* **Company 1 Member A**: `vedant@company.com` (`MemberPassword123!`)
* **Company 1 Member C**: `sneha@company.com` (`MemberPassword123!`)
* **Company 2 Isolated**: `alex@cyberdyne.io` (`MemberPassword123!`)

---

## 4. Frontend Deployment (Vercel)

The frontend is deployed to Vercel with SPA routing enabled via `apps/web/vercel.json`.

### Option A: Via Vercel CLI
```bash
cd apps/web
npx vercel --prod
```

### Option B: Via Vercel Dashboard
1. Import the repository in [Vercel](https://vercel.com).
2. Set **Root Directory** to `apps/web`.
3. Set **Framework Preset** to `Vite`.
4. Configure Environment Variables in the Vercel project settings:

| Environment Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_COMMUNICATION_API_URL` | HTTPS URL of your Render backend | `https://workos-api.onrender.com` |
| `VITE_COMMUNICATION_WS_URL` | WSS URL of your Render backend | `wss://workos-api.onrender.com` |

5. Deploy. Once deployed, add the Vercel production domain to the `CORS_ORIGIN` variable in your Render dashboard.

---

## 5. Local Development `.env` Setup

Copy `.env.example` to `.env` in the root directory for local development:

```bash
cp .env.example .env
```

Your local `.env` only requires:
```ini
NODE_ENV=development
API_PORT=3001
DATABASE_URL=postgresql://app_user:app_pass@localhost:5432/communication_system
CORS_ORIGIN=http://localhost:5173
JWT_ISSUER=http://localhost:4001
JWKS_URL=http://localhost:4001/.well-known/jwks.json
JWT_AUDIENCE=communication-system
VITE_COMMUNICATION_API_URL=http://localhost:3001
VITE_COMMUNICATION_WS_URL=ws://localhost:3001
```
*(Never commit `.env` or paste live connection strings into public chats or issues).*

