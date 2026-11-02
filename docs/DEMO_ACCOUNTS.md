# Demo Accounts (Synthetic Data)

This document lists the pre-seeded demo accounts for testing the WorkOS Internal Communication System.

> [!NOTE]
> All accounts below use synthetic data and belong to the same primary organization (`WorkOS Enterprise Labs` / `Acme Corp`).
> In accordance with security requirements, passwords are never stored in plaintext in the database or server.

---

## 1. Admin Account

- **Role:** Admin (Channel management, member management, audit log access)
- **Name:** Rohan Deshmukh / Bob Martinez
- **Email:** `rohan@company.com` (alias: `admin@acme.example`)
- **Password:** `AdminPassword123!`
- **User ID:** `usr_rohan` (UUID: `00000001-0000-4000-a000-000000000002`)
- **Permissions:**
  - `communication.access`
  - `communication.channel.create`
  - `communication.private_channel.create`
  - `communication.channel.manage`
  - `communication.member.manage`
  - `communication.message.send`
  - `communication.message.moderate`
  - `communication.announcement.publish`
  - `communication.audit.read`

---

## 2. Member Account

- **Role:** Workspace Member
- **Name:** Vedant Kulkarni / Carol Thompson
- **Email:** `vedant@company.com` (alias: `member@acme.example`)
- **Password:** `MemberPassword123!`
- **User ID:** `usr_vedant` (UUID: `00000001-0000-4000-a000-000000000003`)
- **Permissions:**
  - `communication.access`
  - `communication.channel.create`
  - `communication.message.send`

---

## Shared Context

- Both users are members of `#engineering` and `#general`.
- A direct message (DM) conversation exists between them with initial messages.
- The Member account cannot access the Admin nav item or Audit Logs modal (server rejects audit requests with `403 Forbidden`).
- The Admin account has full visibility into audit logs and channel moderation.

