import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import type { RequestIdentity } from "../auth/plugin.js";

// Drizzle transaction type (inferred from db.transaction callback)
type TxClient = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
export type Db = TxClient;

export async function withTenantTx<T>(
  identity: RequestIdentity,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Defense-in-depth: set RLS context for every transaction
    await tx.execute(sql`SELECT set_config('app.company_id', ${identity.companyId}, true)`);
    return fn(tx);
  });
}
