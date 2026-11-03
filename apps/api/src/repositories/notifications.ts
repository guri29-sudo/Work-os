import { eq, and, desc, sql } from "drizzle-orm";
import { notifications, users, conversations, messages } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export interface CreateNotificationInput {
  userId: string;
  kind: string;
  conversationId: string;
  messageId?: string | null;
  actorId?: string | null;
}

export const notificationsRepo = {
  async listForUser(identity: RequestIdentity, opts?: { isRead?: boolean; limit?: number }) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(notifications.user_id, identity.userId),
        eq(notifications.company_id, identity.companyId),
      ];
      if (opts?.isRead !== undefined) {
        conditions.push(eq(notifications.is_read, opts.isRead));
      }
      const rows = await tx
        .select({
          id: notifications.id,
          user_id: notifications.user_id,
          company_id: notifications.company_id,
          kind: notifications.kind,
          conversation_id: notifications.conversation_id,
          message_id: notifications.message_id,
          actor_id: notifications.actor_id,
          is_read: notifications.is_read,
          created_at: notifications.created_at,
          actor_name: users.name,
          actor_avatar_url: users.avatar_url,
          conversation_name: conversations.name,
          message_snippet: messages.body,
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.actor_id, users.id))
        .leftJoin(conversations, eq(notifications.conversation_id, conversations.id))
        .leftJoin(messages, eq(notifications.message_id, messages.id))
        .where(and(...conditions))
        .orderBy(desc(notifications.created_at))
        .limit(opts?.limit ?? 50);

      return rows;
    });
  },

  async getUnreadCount(identity: RequestIdentity): Promise<number> {
    return withTenantTx(identity, async (tx: Db) => {
      const [res] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, identity.userId),
            eq(notifications.company_id, identity.companyId),
            eq(notifications.is_read, false),
          ),
        );
      return res?.count ?? 0;
    });
  },

  async markAsRead(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [updated] = await tx
        .update(notifications)
        .set({ is_read: true })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.user_id, identity.userId),
            eq(notifications.company_id, identity.companyId),
          ),
        )
        .returning();
      return updated ?? null;
    });
  },

  async markAllAsRead(identity: RequestIdentity): Promise<number> {
    return withTenantTx(identity, async (tx: Db) => {
      const res = await tx
        .update(notifications)
        .set({ is_read: true })
        .where(
          and(
            eq(notifications.user_id, identity.userId),
            eq(notifications.company_id, identity.companyId),
            eq(notifications.is_read, false),
          ),
        )
        .returning({ id: notifications.id });
      return res.length;
    });
  },

  async create(identity: RequestIdentity, input: CreateNotificationInput) {
    return withTenantTx(identity, async (tx: Db) => {
      const [created] = await tx
        .insert(notifications)
        .values({
          user_id: input.userId,
          company_id: identity.companyId,
          kind: input.kind,
          conversation_id: input.conversationId,
          message_id: input.messageId ?? null,
          actor_id: input.actorId ?? null,
          is_read: false,
        })
        .returning();
      return created;
    });
  },
};
