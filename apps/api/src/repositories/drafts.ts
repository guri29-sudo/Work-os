import { eq, and } from "drizzle-orm";
import { drafts } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export const draftsRepo = {
  async save(identity: RequestIdentity, conversationId: string, body: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [d] = await tx
        .insert(drafts)
        .values({
          conversation_id: conversationId,
          user_id: identity.userId,
          company_id: identity.companyId,
          body,
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [drafts.conversation_id, drafts.user_id],
          set: {
            body,
            updated_at: new Date(),
          },
        })
        .returning();
      return d;
    });
  },

  async get(identity: RequestIdentity, conversationId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [d] = await tx
        .select()
        .from(drafts)
        .where(
          and(
            eq(drafts.conversation_id, conversationId),
            eq(drafts.user_id, identity.userId),
            eq(drafts.company_id, identity.companyId),
          ),
        )
        .limit(1);
      return d ?? null;
    });
  },

  async delete(identity: RequestIdentity, conversationId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const deleted = await tx
        .delete(drafts)
        .where(
          and(
            eq(drafts.conversation_id, conversationId),
            eq(drafts.user_id, identity.userId),
            eq(drafts.company_id, identity.companyId),
          ),
        )
        .returning();
      return deleted.length > 0;
    });
  },
};
