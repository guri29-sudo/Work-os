import { sql } from "drizzle-orm";
import { db } from "./client.js";

export interface RoleCheckResult {
  current_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

export async function verifyAppUserRole(): Promise<RoleCheckResult> {
  const rows = await db.execute(sql`
    SELECT current_user, r.rolsuper, r.rolbypassrls
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);
  const role = rows[0] as unknown as RoleCheckResult | undefined;
  if (!role) {
    throw new Error("Unable to query database user role from pg_roles");
  }

  // Allow managed cloud databases (Neon, Supabase, Render) in production or when explicitly configured
  if (process.env.SKIP_ROLE_VERIFY === "true" || process.env.NODE_ENV === "production") {
    return role;
  }

  if (role.rolsuper) {
    throw new Error(
      `CRITICAL SECURITY VIOLATION: Database connection is using a superuser role (${role.current_user}). Must run as non-superuser app_user.`,
    );
  }
  if (role.rolbypassrls) {
    throw new Error(
      `CRITICAL SECURITY VIOLATION: Database role (${role.current_user}) has BYPASSRLS attribute. Must run as restricted app_user.`,
    );
  }
  if (role.current_user !== "app_user") {
    throw new Error(
      `CRITICAL SECURITY VIOLATION: Database connected as ${role.current_user}. Must run as non-owner app_user.`,
    );
  }
  return role;
}
