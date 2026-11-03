import { eq, and } from "drizzle-orm";
import { reactions } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export const reactionsRepo = {
  async add(
    identity: RequestIdentity,
    opts: { messageId: string; conversationId: string; emoji: string },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const [r] = await tx
        .insert(reactions)
        .values({
          message_id: opts.messageId,
          conversation_id: opts.conversationId,
          company_id: identity.companyId,
          user_id: identity.userId,
          emoji: opts.emoji,
        })
        .onConflictDoNothing()
        .returning();
      return r ?? null;
    });
  },

  async remove(
    identity: RequestIdentity,
    opts: { messageId: string; conversationId: string; emoji: string },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const deleted = await tx
        .delete(reactions)
        .where(
          and(
            eq(reactions.message_id, opts.messageId),
            eq(reactions.user_id, identity.userId),
            eq(reactions.emoji, opts.emoji),
            eq(reactions.company_id, identity.companyId),
          ),
        )
        .returning();
      return deleted.length > 0;
    });
  },

  async listForMessage(identity: RequestIdentity, messageId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx
        .select({
          emoji: reactions.emoji,
          user_id: reactions.user_id,
        })
        .from(reactions)
        .where(
          and(eq(reactions.message_id, messageId), eq(reactions.company_id, identity.companyId)),
        );

      const map = new Map<string, string[]>();
      for (const row of rows) {
        const list = map.get(row.emoji) ?? [];
        list.push(row.user_id);
        map.set(row.emoji, list);
      }

      return Array.from(map.entries()).map(([emoji, userIds]) => ({
        emoji,
        count: userIds.length,
        user_ids: userIds,
      }));
    });
  },
};
