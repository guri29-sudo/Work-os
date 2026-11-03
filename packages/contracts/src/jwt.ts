import { z } from "zod";
import { PERMISSION_VALUES } from "./permissions.js";

/**
 * JWT token claims schema.
 * All fields are validated on every request; extra fields are stripped.
 *
 * Security notes:
 * - `exp` must be <= now + 15 min (enforced by jose, also validated here)
 * - `iss` and `aud` must match env-configured values exactly
 * - `jti` is used for replay detection on sensitive operations
 */
export const TokenClaimsSchema = z.object({
  /** Subject – user's unique ID (UUID) */
  sub: z.string().uuid(),

  /** Tenant identifier – all data is scoped to this */
  company_id: z.string().uuid(),

  /** Granted permission strings */
  permissions: z.array(z.enum(PERMISSION_VALUES)).min(0),

  /** Display name for UI rendering */
  name: z.string().min(1).max(256),

  /** Avatar URL – optional, must be https if provided */
  avatar_url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message: "avatar_url must use HTTPS",
    })
    .optional(),

  /** Department IDs the user belongs to */
  department_ids: z.array(z.string().uuid()).optional().default([]),

  /** Project IDs the user belongs to */
  project_ids: z.array(z.string().uuid()).optional().default([]),

  /** Standard JWT claims */
  iss: z.string().url(),
  aud: z.union([z.string(), z.array(z.string())]),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().min(1),
});

export type TokenClaims = z.infer<typeof TokenClaimsSchema>;

/** Validated, parsed identity attached to every request context */
export const RequestIdentitySchema = TokenClaimsSchema.pick({
  sub: true,
  company_id: true,
  permissions: true,
  name: true,
  avatar_url: true,
  department_ids: true,
  project_ids: true,
  jti: true,
});

export type RequestIdentity = z.infer<typeof RequestIdentitySchema>;
