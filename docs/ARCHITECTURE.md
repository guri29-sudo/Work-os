# Architecture Overview

## System Boundaries

The Communication System is a **standalone, self-contained service**. It:
- ? Receives WorkOS-issued JWTs and validates them via JWKS
- ? Stores its own data in its own PostgreSQL database
- ? Never reads from or writes to any WorkOS database
- ? Never makes HTTP calls to WorkOS APIs
- ? Never hardcodes WorkOS URLs, keys, or role names

---

## Repository Layout

```
communication-system/
+-- apps/
¦   +-- web/              React 19 + Vite frontend
¦   +-- api/              Fastify + Node 22 backend
¦   +-- mock-idp/         Dev-only JWT issuer (port 4001)
¦   +-- mock-webhook/     Dev-only webhook receiver (port 4002)
+-- packages/
¦   +-- contracts/        Zod schemas, types, events, permissions
¦   +-- sdk/              Integration client for host apps
¦   +-- ui/               Reusable React components + design tokens
¦   +-- test-fixtures/    Synthetic companies, users, channels
+-- docs/                 All documentation
+-- infra/                Docker, CI, backup scripts
+-- .github/workflows/    GitHub Actions CI
```

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Reproducible installs, incremental builds |
| Language | TypeScript 5.7, strict mode | Type safety across all packages |
| Backend | Node 22 + Fastify | Performance, plugin ecosystem, WebSocket support |
| Auth | jose (JWT/JWKS) | RFC-compliant, actively maintained |
| Database | PostgreSQL 16 + Drizzle ORM | SQL migrations, RLS, full-text search |
| Storage | S3/MinIO | Pre-signed URLs, never through API |
| Real-time | @fastify/websocket + PG LISTEN/NOTIFY | No Redis dependency initially |
| Frontend | React 19 + Vite + TanStack | Modern, performant |
| Styling | Tailwind CSS v4 + CSS variables | Design tokens, dark mode |
| Animation | Motion (framer-motion) | Spring physics, GPU-only transitions |
| Virtualization | TanStack Virtual | 100k+ messages at 60fps |
| Testing | Vitest + Playwright + Testcontainers | Unit, integration, E2E |

---

## Data Flow

```
Host App (WorkOS)
      ¦
      ¦ JWT (RS256, =15min)
      ?
+----------------------------------------------------------+
¦                  Communication System                     ¦
¦                                                          ¦
¦  +-------------+    +--------------+    +-------------+ ¦
¦  ¦  React SPA  ¦?--?¦ Fastify API  ¦?--?¦ PostgreSQL  ¦ ¦
¦  ¦  (port 5173)¦    ¦  (port 3001) ¦    ¦  (port 5432)¦ ¦
¦  ¦             ¦    ¦              ¦    +-------------+ ¦
¦  ¦  WebSocket  ¦?--?¦  WS Gateway  ¦                    ¦
¦  +-------------+    +--------------+    +-------------+ ¦
¦                            ¦            ¦   MinIO S3  ¦ ¦
¦                            +-----------?¦  (port 9000)¦ ¦
¦                                         +-------------+ ¦
+----------------------------------------------------------+
      ¦
      ¦ JWKS verification
      ?
Mock IdP (port 4001) – DEV ONLY
```

---

## Authorization Architecture

```
HTTP Request
     ¦
     ?
authPlugin (Fastify)
  - Extract Bearer token
  - Verify via JWKS (cached, rotation-aware)
  - Validate claims (iss, aud, exp =15min, company_id UUID)
  - Attach RequestIdentity to request
     ¦
     ?
Route Handler
  - Call policy.require(identity, PERMISSION.X)
  - (throws 403 if missing)
     ¦
     ?
Repository Layer
  - All queries require (companyId, userId)
  - Postgres RLS: SET LOCAL app.company_id = ?
  - Membership checks for conversation access
     ¦
     ?
Database
```

---

## Real-Time Architecture

```
Client WebSocket (auth handshake with JWT)
     ¦
     ?
WS Gateway (Fastify)
  - Validate auth message (same JWT verification)
  - Subscribe to conversations (membership-checked)
  - Heartbeat / reconnect with cursor
     ¦
     ?
Postgres LISTEN/NOTIFY
  - Channel: "company_{company_id}"
  - Payload: JSON event (from DB trigger or outbox)
  - Each API instance subscribes and fan-outs to WS clients
     ¦
     ?
Client receives ServerEvent (versioned, Zod-validated)
```

---

## Outbox Pattern (Webhooks)

Messages that trigger webhooks are written atomically with an outbox entry:

```sql
BEGIN;
  INSERT INTO messages (...) VALUES (...);
  INSERT INTO webhook_outbox (event_type, payload, company_id) VALUES (...);
COMMIT;
```

A background worker reads from `webhook_outbox`, delivers with HMAC-SHA256
signature, retries with exponential backoff, and marks as dead-letter after
max attempts.
