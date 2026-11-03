# Architecture Decisions

This document records non-obvious design choices made during development.
When in doubt, the most secure and standards-aligned option was chosen.

---

## AD-001: JWT max age hard-capped at 15 minutes

**Decision:** Token lifetime is validated server-side to be <= 900 seconds
(15 minutes) regardless of the `TOKEN_TTL_SECONDS` env var. The env var
only controls the *requested* TTL; the server rejects tokens with longer
claimed lifetimes.

**Rationale:** Short-lived tokens reduce blast radius of token leakage.
WorkOS recommends <= 15 min for service tokens.

---

## AD-002: JWKS cache TTL = 5 minutes with rotation support

**Decision:** The JWKS endpoint is cached for 5 minutes. On a `kid` miss
(key rotation), the cache is invalidated immediately and keys are
re-fetched. Up to 2 previous keys are kept for rotation grace periods.

**Rationale:** Balances freshness vs. load. Immediate invalidation on
`kid` miss ensures seamless key rotation without downtime.

---

## AD-003: Keyset (cursor) pagination everywhere

**Decision:** All list endpoints use keyset pagination with opaque base64
cursors. No offset-based pagination is exposed.

**Rationale:** Offset pagination degrades at scale (OFFSET N scans N rows).
Keyset pagination is O(log n) with an index on `(conversation_id, seq)`.
The cursor includes both `seq` and `id` to handle duplicate sequences.

---

## AD-004: Private DMs never accessible to admins or moderators

**Decision:** Moderators can only soft-delete messages by ID (they cannot
read DM content to decide). DM conversations are excluded from admin search.
The only exception is documented break-glass access requiring explicit audit.

**Rationale:** Requirement 1.9 is non-negotiable. Trust boundary: users
expect DMs to be truly private.

---

## AD-005: Idempotency via unique constraint, not advisory lock

**Decision:** `messages` table has a unique index on `(author_id, conversation_id, client_msg_id)`.
Idempotent replay is handled by catching the unique constraint violation
and returning the existing message.

**Rationale:** Advisory locks require session affinity. The unique constraint
approach works across multiple API instances and is atomically correct.

---

## AD-006: Postgres LISTEN/NOTIFY for real-time fan-out

**Decision:** WebSocket events are published via Postgres LISTEN/NOTIFY
channels (per-company). Each API instance subscribes and fans out to
connected WebSocket clients.

**Rationale:** Avoids adding Redis/Kafka as a dependency for Stage 2.
The interface is pluggable (see `packages/contracts` `PubSubAdapter`).
Can be swapped for Redis pub/sub in production without API changes.

---

## AD-007: Attachment flow is pre-signed upload ? finalize

**Decision:** Clients request a pre-signed PUT URL, upload directly to
MinIO/S3, then call `/finalize`. The server verifies size, MIME type, and
SHA-256 checksum before marking the attachment as accessible.

**Rationale:** Files never transit the API server, eliminating memory
pressure. Server-side validation prevents MIME confusion and size bypass.

---

## AD-008: Postgres RLS as defense-in-depth, not primary auth

**Decision:** Row-Level Security is enabled with `SET LOCAL app.company_id`
per transaction, but the primary authorization check is the repository layer
which requires explicit `companyId` arguments.

**Rationale:** RLS alone can be bypassed by superuser connections or
misconfigured session variables. The application layer is the authoritative
check; RLS is a safety net.

---

## AD-009: No login implementation

**Decision:** This system never implements login, session management, or
password storage. It only validates incoming JWTs. The mock-idp exists
solely for development token issuance.

**Rationale:** Requirement 1.4 is absolute. Login belongs to WorkOS.

---

## AD-010: Monorepo with pnpm workspaces + Turborepo

**Decision:** pnpm for package management (disk-efficient, strict by default),
Turborepo for build orchestration (caching, dependency ordering).

**Rationale:** Native workspace support, reproducible installs, incremental
builds reduce CI time as the codebase grows.
