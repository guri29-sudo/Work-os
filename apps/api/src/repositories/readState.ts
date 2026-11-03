import { eq, and, sql, gt, count } from "drizzle-orm";
import { memberships, messages } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export const readStateRepo = {
  async markRead(identity: RequestIdentity, conversationId: string, lastReadMessageId?: string) {
    return withTenantTx(identity, async (tx: Db) => {
      let targetId = lastReadMessageId;
      let targetSeq = 0;

      if (targetId) {
        const [targetMsg] = await tx
          .select({ seq: messages.seq })
          .from(messages)
          .where(
            and(
              eq(messages.id, targetId),
              eq(messages.conversation_id, conversationId),
              eq(messages.company_id, identity.companyId),
            ),
          )
          .limit(1);
        targetSeq = targetMsg?.seq ?? 0;
      } else {
        const [latestMsg] = await tx
          .select({ id: messages.id, seq: messages.seq })
          .from(messages)
          .where(
            and(
              eq(messages.conversation_id, conversationId),
              eq(messages.company_id, identity.companyId),
              sql`deleted_at IS NULL`,
            ),
          )
          .orderBy(sql`seq DESC`)
          .limit(1);
        if (latestMsg) {
          targetId = latestMsg.id;
          targetSeq = latestMsg.seq;
        }
      }

      if (targetId) {
        await tx
          .update(memberships)
          .set({
            last_read_message_id: targetId,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(memberships.conversation_id, conversationId),
              eq(memberships.user_id, identity.userId),
              eq(memberships.company_id, identity.companyId),
            ),
          );
      }

      return { conversationId, lastReadMessageId: targetId ?? null, lastSeq: targetSeq };
    });
  },

  async getUnreadCount(identity: RequestIdentity, conversationId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [membership] = await tx
        .select({
          last_read_message_id: memberships.last_read_message_id,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, identity.userId),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .limit(1);

      let lastSeq = 0;
      if (membership?.last_read_message_id) {
        const [lastMsg] = await tx
          .select({ seq: messages.seq })
          .from(messages)
          .where(
            and(
              eq(messages.id, membership.last_read_message_id),
              eq(messages.conversation_id, conversationId),
              eq(messages.company_id, identity.companyId),
            ),
          )
          .limit(1);
        if (lastMsg) lastSeq = lastMsg.seq;
      }

      // Count messages with seq > lastSeq and not deleted
      const [res] = await tx
        .select({ count: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversation_id, conversationId),
            eq(messages.company_id, identity.companyId),
            gt(messages.seq, lastSeq),
            sql`deleted_at IS NULL`,
          ),
        );

      // Mention count
      const [mRes] = await tx
        .select({ count: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversation_id, conversationId),
            eq(messages.company_id, identity.companyId),
            gt(messages.seq, lastSeq),
            sql`deleted_at IS NULL`,
            sql`${identity.userId} = ANY(mention_ids)`,
          ),
        );

      return {
        conversation_id: conversationId,
        unread_count: res?.count ?? 0,
        mention_count: mRes?.count ?? 0,
      };
    });
  },

  async listAllUnreads(identity: RequestIdentity) {
    return withTenantTx(identity, async (tx: Db) => {
      const convs = await tx
        .select({ conversation_id: memberships.conversation_id })
        .from(memberships)
        .where(
          and(
            eq(memberships.user_id, identity.userId),
            eq(memberships.company_id, identity.companyId),
          ),
        );

      const results = [];
      for (const c of convs) {
        const unread = await readStateRepo.getUnreadCount(identity, c.conversation_id);
        results.push(unread);
      }
      return results;
    });
  },
};
