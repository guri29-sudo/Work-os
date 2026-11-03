/**
 * Synthetic channel/conversation fixtures for seeding and testing.
 */
import { COMPANY_ACME, COMPANY_GLOBEX } from "./companies.js";
import { ALICE, BOB, CAROL, FRANK } from "./users.js";

export interface SyntheticChannel {
  id: string;
  company_id: string;
  name: string;
  kind: "company" | "department" | "project" | "public" | "private" | "announcement";
  topic: string | null;
  is_announcement_only: boolean;
  department_id?: string;
  project_id?: string;
  created_by: string;
  member_ids: string[];
}

// --- Acme Channels ------------------------------------------------------------

export const CHANNEL_GENERAL: SyntheticChannel = {
  id: "c0000000-0000-4000-a000-000000000001",
  company_id: COMPANY_ACME.id,
  name: "general",
  kind: "company",
  topic: "Acme Corp company-wide announcements and chat",
  is_announcement_only: false,
  created_by: ALICE.id,
  member_ids: ["u0000000-0000-4000-a000-000000000001", "u0000000-0000-4000-a000-000000000002", "u0000000-0000-4000-a000-000000000003", "u0000000-0000-4000-a000-000000000004"],
};

export const CHANNEL_ENGINEERING: SyntheticChannel = {
  id: "c0000000-0000-4000-a000-000000000002",
  company_id: COMPANY_ACME.id,
  name: "engineering",
  kind: "department",
  topic: "Engineering team – architecture, code review, deployments",
  is_announcement_only: false,
  department_id: COMPANY_ACME.department_ids[0]!.id,
  created_by: BOB.id,
  member_ids: ["u0000000-0000-4000-a000-000000000001", "u0000000-0000-4000-a000-000000000002"],
};

export const CHANNEL_ANNOUNCEMENTS: SyntheticChannel = {
  id: "c0000000-0000-4000-a000-000000000003",
  company_id: COMPANY_ACME.id,
  name: "announcements",
  kind: "announcement",
  topic: "Company-wide announcements – read only for most members",
  is_announcement_only: true,
  created_by: ALICE.id,
  member_ids: ["u0000000-0000-4000-a000-000000000001", "u0000000-0000-4000-a000-000000000002", "u0000000-0000-4000-a000-000000000003"],
};

export const CHANNEL_DESIGN_PRIVATE: SyntheticChannel = {
  id: "c0000000-0000-4000-a000-000000000004",
  company_id: COMPANY_ACME.id,
  name: "design-private",
  kind: "private",
  topic: "Private design discussions",
  is_announcement_only: false,
  created_by: CAROL.id,
  member_ids: ["u0000000-0000-4000-a000-000000000001", "u0000000-0000-4000-a000-000000000003"],
};

export const CHANNEL_PROJECT_PHOENIX: SyntheticChannel = {
  id: "c0000000-0000-4000-a000-000000000005",
  company_id: COMPANY_ACME.id,
  name: "proj-phoenix",
  kind: "project",
  topic: "Project Phoenix coordination channel",
  is_announcement_only: false,
  project_id: COMPANY_ACME.project_ids[0]!.id,
  created_by: BOB.id,
  member_ids: ["u0000000-0000-4000-a000-000000000001", "u0000000-0000-4000-a000-000000000002", "u0000000-0000-4000-a000-000000000003"],
};

// --- DM Conversations ---------------------------------------------------------

export const DM_ALICE_BOB = {
  id: "c0000000-0000-4000-a000-000000000010",
  company_id: COMPANY_ACME.id,
  type: "dm" as const,
  member_ids: [ALICE.id, BOB.id],
};

// --- Globex Channels ----------------------------------------------------------

export const CHANNEL_GLOBEX_GENERAL: SyntheticChannel = {
  id: "c0000000-0000-4000-b000-000000000001",
  company_id: COMPANY_GLOBEX.id,
  name: "general",
  kind: "company",
  topic: "Globex Industries company channel",
  is_announcement_only: false,
  created_by: FRANK.id,
  member_ids: ["u0000000-0000-4000-b000-000000000006", "u0000000-0000-4000-b000-000000000007", "u0000000-0000-4000-b000-000000000008"],
};

export const ACME_CHANNELS = [
  CHANNEL_GENERAL,
  CHANNEL_ENGINEERING,
  CHANNEL_ANNOUNCEMENTS,
  CHANNEL_DESIGN_PRIVATE,
  CHANNEL_PROJECT_PHOENIX,
] as const;

export const GLOBEX_CHANNELS = [CHANNEL_GLOBEX_GENERAL] as const;
export const ALL_CHANNELS = [...ACME_CHANNELS, ...GLOBEX_CHANNELS] as const;
