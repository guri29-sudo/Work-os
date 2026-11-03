/**
 * AuditLogRepository – append-only writes.
 * The DB trigger blocks UPDATE/DELETE as a second line of defense.
 */
import { eq, and, desc, lt } from "drizzle-orm";
import { auditLog } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";

export interface AuditEntry {
  action: typeof auditLog.$inferInsert["action"];
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export const auditRepo = {
  async write(identity: RequestIdentity, entry: AuditEntry): Promise<void> {
    await withTenantTx(identity, async (tx) => {
      await tx.insert(auditLog).values({
        company_id: identity.companyId,
        actor_id: identity.userId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        metadata: entry.metadata ?? {},
        ip_address: entry.ipAddress ?? null,
        user_agent: entry.userAgent ?? null,
      });
    });
  },

  async list(
    identity: RequestIdentity,
    opts: { cursor?: string; limit: number },
  ) {
    return withTenantTx(identity, async (tx) => {
      const conditions = [eq(auditLog.company_id, identity.companyId)];
      if (opts.cursor) {
        conditions.push(lt(auditLog.id, opts.cursor));
      }
      return tx
        .select()
        .from(auditLog)
        .where(and(...conditions))
        .orderBy(desc(auditLog.created_at))
        .limit(opts.limit + 1);
    });
  },
};
