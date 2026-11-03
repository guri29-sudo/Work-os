# Role-Based Access Control

## Overview

Authorization is claim-based, not role-based. JWT tokens carry explicit
`permissions[]` arrays. The server validates each permission using a central
policy module — never ad-hoc inline checks.

Roles are **informational** — they describe a typical permission bundle.
Actual granted permissions come from the token, not a database role lookup.

---

## Permission Reference

| Constant | Claim String | Description |
|---|---|---|
| `ACCESS` | `communication.access` | Required for any API call |
| `CHANNEL_CREATE` | `communication.channel.create` | Create public/dept/project channels |
| `PRIVATE_CHANNEL_CREATE` | `communication.private_channel.create` | Create private channels |
| `CHANNEL_MANAGE` | `communication.channel.manage` | Edit name/topic, pin messages, archive |
| `MEMBER_MANAGE` | `communication.member.manage` | Add/remove members, change roles |
| `MESSAGE_SEND` | `communication.message.send` | Send messages in accessible conversations |
| `MESSAGE_MODERATE` | `communication.message.moderate` | Delete/restore any message (see DM exception) |
| `ANNOUNCEMENT_PUBLISH` | `communication.announcement.publish` | Post in announcement-only channels |
| `AUDIT_READ` | `communication.audit.read` | Read audit log for own company |

---

## Role ? Default Permissions Matrix

| Permission | owner | admin | member | guest | bot |
|---|:---:|:---:|:---:|:---:|:---:|
| `communication.access` | ? | ? | ? | ? | ? |
| `communication.channel.create` | ? | ? | ? | – | – |
| `communication.private_channel.create` | ? | ? | – | – | – |
| `communication.channel.manage` | ? | ? | – | – | – |
| `communication.member.manage` | ? | ? | – | – | – |
| `communication.message.send` | ? | ? | ? | ? | ? |
| `communication.message.moderate` | ? | ? | – | – | – |
| `communication.announcement.publish` | ? | ? | – | – | ? |
| `communication.audit.read` | ? | ? | – | – | – |

---

## Synthetic User Fixture Permissions

| User | Tag | Company | Role | Notable Permissions |
|---|---|---|---|---|
| Alice Chen | `acme-owner` | Acme Corp | owner | All permissions |
| Bob Martinez | `acme-admin` | Acme Corp | admin | All except (effectively same as admin) |
| Carol Thompson | `acme-member` | Acme Corp | member | access, channel.create, message.send |
| Dave Kim | `acme-guest` | Acme Corp | guest | access, message.send |
| Eve (CI Bot) | `acme-bot` | Acme Corp | bot | access, message.send, announcement.publish |
| Frank Burns | `globex-owner` | Globex Industries | owner | All permissions |
| Grace Hopper | `globex-admin` | Globex Industries | admin | All admin permissions |
| Hector Rodriguez | `globex-member` | Globex Industries | member | access, channel.create, message.send |
| Ivy Lee | `globex-member-private` | Globex Industries | member+ | access, message.send, private_channel.create |
| James Wright | `globex-readonly` | Globex Industries | guest | access only |

---

## Token Claims Contract

Every JWT must contain:

```json
{
  "sub": "<uuid>",
  "company_id": "<uuid>",
  "permissions": ["communication.access", "..."],
  "name": "Display Name",
  "avatar_url": "https://...",
  "department_ids": ["<uuid>", "..."],
  "project_ids": ["<uuid>", "..."],
  "iss": "<issuer-url>",
  "aud": "communication-system",
  "iat": 1234567890,
  "exp": 1234568790,
  "jti": "<uuid>"
}
```

**Validation rules:**
1. `iss` must match `JWT_ISSUER` env var exactly
2. `aud` must include `JWT_AUDIENCE` env var
3. `exp - iat <= 900` (15 minute max lifetime)
4. `exp > now` (not expired)
5. `kid` in JWT header must exist in JWKS
6. Signature must verify against the matching public key
7. `company_id` must be a valid UUID

---

## Conversation-Level Authorization

Beyond token-level permissions, every conversation access check enforces:

1. **Company isolation:** `conversation.company_id == token.company_id`
2. **Membership check:** `memberships` record exists for `(user_id, conversation_id)`
   - Exception: public/company channels visible to all company members
3. **Private channel:** only explicit members can see/access
4. **DM/Group DM:** only explicit members (never searchable by non-members)
5. **Announcement channel:** `MESSAGE_SEND` is blocked; only `ANNOUNCEMENT_PUBLISH` allowed

---

## Break-Glass Policy

Break-glass access (exceptional admin read of private DMs for legal/safety
reasons) requires:

1. A human approval from 2 admins + 1 owner
2. Written documented reason
3. Automatic audit log entry with `action: "break_glass.accessed"`
4. Notification to the company owner
5. Time-limited scope (max 24 hours, specific conversation ID only)

See `docs/SECURITY.md` for the full threat model.

---

## Tenant Isolation Guarantee

Every database query in the repository layer requires both `companyId` and
`userId` arguments. The Drizzle ORM repository wrapper appends
`WHERE company_id = $companyId` to every query. Additionally, Postgres RLS
enforces `app.company_id` session variable as a defense-in-depth layer.

Cross-company access via guessed UUIDs is impossible because:
- UUID guessing probability is astronomically low
- Every query scopes to `company_id` from the validated token
- Membership checks provide a second isolation layer
