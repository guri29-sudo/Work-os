# WorkOS Internal Communication System — Final Handoff Document

This document provides the complete engineering handoff for the **WorkOS Internal Communication System** in accordance with Section 12 of the specification.

---

## 1. System Overview & Architecture Boundary

The WorkOS Internal Communication System is a **secure, standalone multi-tenant communication platform** designed for native embedding inside the WorkOS host application.

### Key Architectural Boundaries:
- **No Shared Database**: The communication database is completely isolated from WorkOS core databases. All tenant tables enforce multi-tenancy with `company_id` and Row-Level Security (RLS).
- **Non-Superuser Database Connection**: The API connects as non-superuser role `app_user` (`rolsuper = false`, `rolbypassrls = false`).
- **Opaque Object References**: WorkOS business records (Projects, Tasks, Customers, Invoices) are referenced opaquely (`type`, `id`, `display_title`, `status`) without database foreign keys or schema coupling.
- **Host Callback Integration**: Host actions (e.g., "Open in WorkOS", "Create Task") are delegated to the WorkOS host application via React callbacks (`onOpenObject`, `onCreateTask`).
- **Identity Token Verification**: The API does not handle login; it cryptographically verifies short-lived RS256 JWT tokens issued by WorkOS or the mock IdP.

---

## 2. Repository Structure

```
WorkOS/
├── apps/
│   ├── api/                   # Fastify HTTP + WebSocket API service (Port 3001)
│   │   ├── src/
│   │   │   ├── auth/          # JWT / JWKS token validation plugin
│   │   │   ├── db/            # Drizzle ORM schema, migrations, seed, and RLS assertion
│   │   │   ├── policy/        # RBAC policy authorization matrix (9 permissions)
│   │   │   ├── repositories/  # Isolated data access layer
│   │   │   ├── routes/        # Fastify v1 routes (Channels, Messages, Attachments, Search, Audit, Webhooks)
│   │   │   ├── storage/       # S3 / MinIO SigV4 presigned upload & download service
│   │   │   ├── ws/            # Real-time WebSocket connection manager & event dispatcher
│   │   │   └── __tests__/     # Unit, acceptance, RBAC, and tenant-isolation test suites
│   ├── web/                   # React 19 + Vite frontend application (Port 5173)
│   │   ├── src/
│   │   │   ├── components/    # AppShell, ConversationView, Composer, ThreadPanel, Modals
│   │   │   ├── context/       # AuthContext, WebSocketContext
│   │   │   └── types.ts       # Typed frontend models
│   └── mock-idp/              # Synthetic identity provider issuing signed JWT test tokens
├── packages/
│   ├── contracts/             # Zod schemas, JWT claims, permissions, and TypeScript interfaces
│   ├── sdk/                   # Headless TypeScript client & embeddable <CommunicationApp />
│   ├── ui/                    # Reusable Tailwind design primitive components (Avatar, Dialog, Popover, etc.)
│   └── test-fixtures/         # Synthetic companies (Acme, Globex) and 10 synthetic identities
├── docs/                      # Complete specifications, API docs, OpenAPI, and RBAC matrix
└── infra/                     # Docker Compose local stack (Postgres, MinIO, Redis)
```

---

## 3. Local Setup & Quickstart

### Prerequisites
- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose (for local PostgreSQL & MinIO)

### One-Command Setup
```bash
# 1. Install all dependencies across workspaces
pnpm install

# 2. Start local PostgreSQL and MinIO services
docker compose -f infra/docker-compose.yml up -d

# 3. Apply database migrations and seed synthetic tenants
pnpm --filter @cs/api db:migrate
pnpm --filter @cs/api db:seed

# 4. Start backend API and frontend demo
pnpm dev
```

### Environment Variables
Each application contains a `.env.example` file. Copy to `.env` in each package:
- `apps/api/.env.example` -> `apps/api/.env`
- `apps/web/.env.example` -> `apps/web/.env`

---

## 4. Embeddable React Integration & SDK

The communication system exports a high-level embeddable React component and headless TypeScript SDK:

```tsx
import { CommunicationApp, WorkOSCommunicationClient } from "@cs/sdk";
import "@cs/ui/styles.css";

function WorkOSHostPage() {
  const getAccessToken = async () => {
    return await fetchWorkOSUserToken();
  };

  const handleOpenObject = (objectRef) => {
    // Navigate to WorkOS native route (e.g., /projects/PRJ-402)
    router.push(`/${objectRef.type}s/${objectRef.id}`);
  };

  const handleCreateTask = ({ messageId, content, authorName }) => {
    // Open WorkOS task creation modal with prefilled message quote
    taskModal.open({ prefillTitle: `Follow up with ${authorName}: ${content}` });
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <CommunicationApp
        getAccessToken={getAccessToken}
        onOpenObject={handleOpenObject}
        onCreateTask={handleCreateTask}
        theme="light"
      />
    </div>
  );
}
```

---

## 5. Verification & Test Suites

The codebase includes exhaustive test suites validating all specification stages:

```bash
# Run unit tests (RBAC matrix, Section 11 acceptance, db-role checks, policy)
pnpm --filter @cs/api test

# Run contracts and UI token/contrast tests
pnpm --filter @cs/contracts test
pnpm --filter @cs/ui test

# Typecheck frontend and backend
pnpm --filter @cs/api typecheck
pnpm --filter @cs/web typecheck

# Production frontend bundle check
pnpm --filter @cs/web build
```

---

## 6. Section 11 Acceptance Demonstration Flow

| Step | Requirement | Implementation & Verification |
|---|---|---|
| **1. Token Auth** | Mock IdP token verification with RBAC claims | `TokenClaimsSchema` validates `sub`, `company_id`, and `permissions` |
| **2. Scoped Channel** | User accesses company-scoped Engineering channel | Tenant boundary enforced; non-matching company queries rejected |
| **3. Messages & Threads** | Message sending with @mention and thread reply | Idempotent POST with idempotency key, mention array, and parent reply |
| **4. Attachments & Objects** | S3 SigV4 presigned upload and opaque WorkOS ref | Expiring signed URL generated; opaque `{ type, id, title }` linked |
| **5. Real-Time Delivery** | Second session receives message & unread state | WebSocket event broadcast dispatched to active channel sessions |
| **6. Search Filtering** | Tenant-scoped search with `<mark>` highlight | PostgreSQL full-text search filtered strictly to caller's `company_id` |
| **7. Private Channel Block** | Unauthorized user blocked from private channel | Membership verification returns 403 Forbidden |
| **8. Cross-Company Block** | Cross-company request rejected | RLS and policy check enforce strict tenant isolation (403 Forbidden) |

---

## 7. Deployment, Monitoring & Operations

### Deployment
- **API**: Containerized Fastify service running Node.js 22 LTS behind a reverse proxy (ALB / NGINX / Cloudflare).
- **Web**: Static Vite build (`apps/web/dist`) hosted on CDN (Cloudflare Pages, S3 + CloudFront, Vercel).
- **Storage**: S3-compatible private bucket (AWS S3, Cloudflare R2, MinIO) with private bucket policy and CORS.

### Health Probes
- Liveness: `GET /health/live` (returns `200 OK`)
- Readiness: `GET /health/ready` (verifies PostgreSQL connection and storage reachability)

### Backup & Recovery
- Daily PostgreSQL `pg_dump` with WAL archiving for point-in-time recovery (PITR).
- S3 Bucket versioning enabled with 30-day lifecycle expiration for temporary upload staging.

### Rollback Strategy
- Database migrations use bidirectional Drizzle schema definitions.
- New database columns are nullable or have defaults to support zero-downtime rolling deploys.
