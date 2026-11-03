/**
 * Synthetic user definitions covering varied permission sets.
 * 5 users per company = 10 total synthetic identities.
 *
 * Passwords are NOT stored here. Auth is handled by mock-idp issuing JWTs.
 */
import type { Permission } from "@cs/contracts";
import { PERMISSIONS, ROLE_DEFAULTS } from "@cs/contracts";
import { COMPANY_ACME, COMPANY_GLOBEX } from "./companies.js";

export interface SyntheticUser {
  id: string;
  company_id: string;
  name: string;
  email: string;
  avatar_url: string;
  /** Role key (informational - real permissions come from JWT) */
  role: keyof typeof ROLE_DEFAULTS;
  permissions: Permission[];
  department_ids: string[];
  project_ids: string[];
  /** Short tag shown in test output */
  tag: string;
}

// --- Acme Corp Users ---------------------------------------------------------

export const ALICE: SyntheticUser = {
  id: "00000001-0000-4000-a000-000000000001",
  company_id: COMPANY_ACME.id,
  name: "Alice Chen",
  email: "alice@acme.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=alice-chen",
  role: "owner",
  permissions: [...ROLE_DEFAULTS.owner],
  department_ids: [
    COMPANY_ACME.department_ids[0]!.id,
    COMPANY_ACME.department_ids[1]!.id,
  ],
  project_ids: [
    COMPANY_ACME.project_ids[0]!.id,
    COMPANY_ACME.project_ids[1]!.id,
  ],
  tag: "acme-owner",
};

export const BOB: SyntheticUser = {
  id: "00000001-0000-4000-a000-000000000002",
  company_id: COMPANY_ACME.id,
  name: "Bob Martinez",
  email: "bob@acme.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=bob-martinez",
  role: "admin",
  permissions: [...ROLE_DEFAULTS.admin],
  department_ids: [COMPANY_ACME.department_ids[0]!.id],
  project_ids: [COMPANY_ACME.project_ids[0]!.id],
  tag: "acme-admin",
};

export const CAROL: SyntheticUser = {
  id: "00000001-0000-4000-a000-000000000003",
  company_id: COMPANY_ACME.id,
  name: "Carol Thompson",
  email: "carol@acme.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=carol-thompson",
  role: "member",
  permissions: [...ROLE_DEFAULTS.member],
  department_ids: [COMPANY_ACME.department_ids[2]!.id],
  project_ids: [COMPANY_ACME.project_ids[1]!.id],
  tag: "acme-member",
};

export const DAVE: SyntheticUser = {
  id: "00000001-0000-4000-a000-000000000004",
  company_id: COMPANY_ACME.id,
  name: "Dave Kim",
  email: "dave@acme.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=dave-kim",
  role: "guest",
  permissions: [...ROLE_DEFAULTS.guest],
  department_ids: [],
  project_ids: [],
  tag: "acme-guest",
};

export const EVE_BOT: SyntheticUser = {
  id: "00000001-0000-4000-a000-000000000005",
  company_id: COMPANY_ACME.id,
  name: "Eve (CI Bot)",
  email: "eve-bot@acme.example",
  avatar_url: "https://api.dicebear.com/9.x/bottts/svg?seed=eve-bot",
  role: "bot",
  permissions: [...ROLE_DEFAULTS.bot],
  department_ids: [],
  project_ids: COMPANY_ACME.project_ids.map((p) => p.id),
  tag: "acme-bot",
};

// --- Globex Industries Users --------------------------------------------------

export const FRANK: SyntheticUser = {
  id: "00000002-0000-4000-b000-000000000006",
  company_id: COMPANY_GLOBEX.id,
  name: "Frank Burns",
  email: "frank@globex.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=frank-burns",
  role: "owner",
  permissions: [...ROLE_DEFAULTS.owner],
  department_ids: [COMPANY_GLOBEX.department_ids[0]!.id],
  project_ids: [COMPANY_GLOBEX.project_ids[0]!.id],
  tag: "globex-owner",
};

export const GRACE: SyntheticUser = {
  id: "00000002-0000-4000-b000-000000000007",
  company_id: COMPANY_GLOBEX.id,
  name: "Grace Hopper",
  email: "grace@globex.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=grace-hopper",
  role: "admin",
  permissions: [...ROLE_DEFAULTS.admin],
  department_ids: [COMPANY_GLOBEX.department_ids[0]!.id],
  project_ids: [COMPANY_GLOBEX.project_ids[0]!.id],
  tag: "globex-admin",
};

export const HECTOR: SyntheticUser = {
  id: "00000002-0000-4000-b000-000000000008",
  company_id: COMPANY_GLOBEX.id,
  name: "Hector Rodriguez",
  email: "hector@globex.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=hector-rodriguez",
  role: "member",
  permissions: [...ROLE_DEFAULTS.member],
  department_ids: [COMPANY_GLOBEX.department_ids[1]!.id],
  project_ids: [],
  tag: "globex-member",
};

export const IVY: SyntheticUser = {
  id: "00000002-0000-4000-b000-000000000009",
  company_id: COMPANY_GLOBEX.id,
  name: "Ivy Lee",
  email: "ivy@globex.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=ivy-lee",
  role: "member",
  permissions: [
    PERMISSIONS.ACCESS,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.PRIVATE_CHANNEL_CREATE,
  ],
  department_ids: [COMPANY_GLOBEX.department_ids[1]!.id],
  project_ids: [COMPANY_GLOBEX.project_ids[0]!.id],
  tag: "globex-member-private",
};

export const JAMES: SyntheticUser = {
  id: "00000002-0000-4000-b000-000000000010",
  company_id: COMPANY_GLOBEX.id,
  name: "James Wright",
  email: "james@globex.example",
  avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=james-wright",
  role: "guest",
  permissions: [PERMISSIONS.ACCESS],
  department_ids: [],
  project_ids: [],
  tag: "globex-readonly",
};

export const ACME_USERS = [ALICE, BOB, CAROL, DAVE, EVE_BOT] as const;
export const GLOBEX_USERS = [FRANK, GRACE, HECTOR, IVY, JAMES] as const;
export const ALL_USERS = [...ACME_USERS, ...GLOBEX_USERS] as const;

/** Lookup user by id across all synthetic users */
export function findUserById(id: string): SyntheticUser | undefined {
  return ALL_USERS.find((u) => u.id === id);
}

/** Lookup user by tag across all synthetic users */
export function findUserByTag(tag: string): SyntheticUser | undefined {
  return ALL_USERS.find((u) => u.tag === tag);
}

/** Alias for backwards compat */
export const syntheticUsers = ALL_USERS;


