import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema/index.js";
import { env } from "../env.js";

export const pool = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(pool, { schema });

/** Sets the RLS session variable. Call inside every transaction for defense-in-depth. */
export async function setRlsContext(companyId: string): Promise<void> {
  await db.execute(sql`SELECT set_config('app.company_id', ${companyId}, true)`);
}
