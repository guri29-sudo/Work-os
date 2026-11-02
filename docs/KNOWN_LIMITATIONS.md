# Known Limitations & Project Status

## Current Status: Stages 1-5 Complete
- **Stage 1 (Contracts & Schemas)**: Completed. JWT claim schemas, RBAC matrix, and OpenAPI 3.1 definitions.
- **Stage 2 (Core Backend & DB)**: Completed. PostgreSQL schema with RLS enforcement, Fastify REST APIs, WebSocket real-time delivery, and non-superuser `app_user` checks.
- **Stage 3 (Frontend Web Client)**: Completed. React 19 + Vite responsive frontend, virtualized message view, composer, threads, reactions, unread badges, and dark/light token theming.
- **Stage 4 (Integration & SDK)**: Completed. `<CommunicationApp />` embeddable package, TypeScript headless SDK (`WorkOSCommunicationClient`), opaque WorkOS object reference cards (`onOpenObject`), host task creation modal (`onCreateTask`), and SigV4 attachment presigning.
- **Stage 5 (Hardening & Compliance)**: Completed. Multi-tenant full-text search with highlight mark snippets, immutable audit logging, and Section 11 8-step Acceptance Demonstration test suite.

## Known Limitations & Planned Post-MVP Enhancements
1. **Multi-Node WebSocket Scaling**:
   - *Current*: Channel WebSocket pub/sub runs in-memory per API process instance.
   - *Recommended Next Step*: Introduce Redis Pub/Sub adapter (`@fastify/redis` / `ioredis`) for zero-loss message distribution across multi-pod Kubernetes clusters.
2. **Antivirus File Scanning**:
   - *Current*: S3/MinIO attachments enforce MIME type whitelists, max file sizes (25MB), and SHA-256 integrity verification before finalizing.
   - *Recommended Next Step*: Implement an asynchronous ClamAV / AWS GuardDuty lambda webhook scanner to quarantine infected uploads prior to download-url issuance.
3. **Threading Hierarchy**:
   - *Current*: Supports Slack-style single-level threading (root message + reply thread) to maintain clean UX and predictable query performance.
   - *Recommended Next Step*: If arbitrary nested trees (Reddit-style) are requested, add nested ltree or recursive CTE queries.
4. **Rich Text Formatting**:
   - *Current*: Supports Markdown formatting (`**bold**`, `*italic*`, ```code```, `@mentions`, links).
   - *Recommended Next Step*: Embed a full TipTap/ProseMirror WYSIWYG editor if rich formatted blocks are required by marketing or legal teams.
