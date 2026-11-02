import { eq, and, asc, gt, sql } from "drizzle-orm";
import { conversations, memberships, users } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export interface CreateChannelInput {
  name: string;
  kind: "company" | "department" | "project" | "public" | "private" | "announcement";
  topic?: string;
  is_announcement_only?: boolean;
  department_id?: string;
  project_id?: string;
  initial_member_ids?: string[];
}

export interface UpdateChannelInput {
  name?: string;
  topic?: string | null;
  is_announcement_only?: boolean;
}

export const conversationsRepo = {
  async listForUser(
    identity: RequestIdentity,
    opts: { cursor?: string; limit: number; type?: "channel" | "dm" | "group_dm" },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(memberships.user_id, identity.userId),
        eq(memberships.company_id, identity.companyId),
      ];
      if (opts.type) {
        conditions.push(eq(conversations.type, opts.type));
      }
      if (opts.cursor) conditions.push(gt(conversations.id, opts.cursor));
      return tx
        .select({
          id: conversations.id,
          company_id: conversations.company_id,
          type: conversations.type,
          kind: conversations.kind,
          name: conversations.name,
          topic: conversations.topic,
          is_archived: conversations.is_archived,
          is_announcement_only: conversations.is_announcement_only,
          member_count: sql<number>`(SELECT count(*)::int FROM memberships WHERE memberships.conversation_id = ${conversations.id})`,
          last_message_at: conversations.last_message_at,
          created_at: conversations.created_at,
        })
        .from(conversations)
        .innerJoin(
          memberships,
          and(
            eq(memberships.conversation_id, conversations.id),
            eq(memberships.user_id, identity.userId),
          ),
        )
        .where(and(...conditions))
        .orderBy(asc(conversations.id))
        .limit(opts.limit + 1);
    });
  },

  async getById(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx
        .select({
          id: conversations.id,
          company_id: conversations.company_id,
          type: conversations.type,
          kind: conversations.kind,
          name: conversations.name,
          topic: conversations.topic,
          is_archived: conversations.is_archived,
          is_announcement_only: conversations.is_announcement_only,
          department_id: conversations.department_id,
          project_id: conversations.project_id,
          member_count: sql<number>`(SELECT count(*)::int FROM memberships WHERE memberships.conversation_id = ${conversations.id})`,
          last_message_at: conversations.last_message_at,
          created_by: conversations.created_by,
          created_at: conversations.created_at,
          updated_at: conversations.updated_at,
        })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.company_id, identity.companyId)))
        .limit(1);
      return rows[0] ?? null;
    });
  },

  async ensureMembership(identity: RequestIdentity, conversationId: string): Promise<boolean> {
    return withTenantTx(identity, async (tx: Db) => {
      const existing = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, identity.userId),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .limit(1);
      if (existing.length > 0) return true;

      const [conv] = await tx
        .select({ kind: conversations.kind, type: conversations.type })
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.company_id, identity.companyId)))
        .limit(1);

      if (!conv) return false;
      if (conv.type === "channel" && (conv.kind === "public" || conv.kind === "company" || !conv.kind)) {
        await tx
          .insert(memberships)
          .values({
            conversation_id: conversationId,
            user_id: identity.userId,
            company_id: identity.companyId,
            role: "member",
          })
          .onConflictDoNothing();
        return true;
      }
      return false;
    });
  },

  async isMember(identity: RequestIdentity, conversationId: string): Promise<boolean> {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, identity.userId),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .limit(1);
      if (rows.length > 0) return true;

      const [conv] = await tx
        .select({ kind: conversations.kind, type: conversations.type })
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.company_id, identity.companyId)))
        .limit(1);

      return !!conv && conv.type === "channel" && (conv.kind === "public" || conv.kind === "company" || !conv.kind);
    });
  },

  async getMemberRole(identity: RequestIdentity, conversationId: string, userId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [m] = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, userId),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .limit(1);
      return m?.role ?? null;
    });
  },

  async createChannel(identity: RequestIdentity, input: CreateChannelInput) {
    return withTenantTx(identity, async (tx: Db) => {
      const initialIds = Array.from(
        new Set([identity.userId, ...(input.initial_member_ids ?? [])]),
      );
      const [conv] = await tx
        .insert(conversations)
        .values({
          company_id: identity.companyId,
          type: "channel",
          kind: input.kind,
          name: input.name,
          topic: input.topic ?? null,
          is_announcement_only: input.is_announcement_only ?? false,
          department_id: input.department_id ?? null,
          project_id: input.project_id ?? null,
          member_count: initialIds.length,
          created_by: identity.userId,
        })
        .returning();
      if (!conv) throw new Error("Failed to create conversation");

      for (const uid of initialIds) {
        await tx
          .insert(memberships)
          .values({
            conversation_id: conv.id,
            user_id: uid,
            company_id: identity.companyId,
            role: uid === identity.userId ? "owner" : "member",
          })
          .onConflictDoNothing();
      }

      await tx.execute(
        sql`INSERT INTO message_seq_counters (conversation_id, last_seq) VALUES (${conv.id}, 0)`,
      );

      return conv;
    });
  },

  async updateChannel(identity: RequestIdentity, id: string, input: UpdateChannelInput) {
    return withTenantTx(identity, async (tx: Db) => {
      const updateData: Partial<typeof conversations.$inferInsert> = {
        updated_at: new Date(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.topic !== undefined) updateData.topic = input.topic;
      if (input.is_announcement_only !== undefined)
        updateData.is_announcement_only = input.is_announcement_only;

      const [updated] = await tx
        .update(conversations)
        .set(updateData)
        .where(and(eq(conversations.id, id), eq(conversations.company_id, identity.companyId)))
        .returning();
      return updated ?? null;
    });
  },

  async archiveChannel(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [updated] = await tx
        .update(conversations)
        .set({ is_archived: true, updated_at: new Date() })
        .where(and(eq(conversations.id, id), eq(conversations.company_id, identity.companyId)))
        .returning();
      return updated ?? null;
    });
  },

  async unarchiveChannel(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const [updated] = await tx
        .update(conversations)
        .set({ is_archived: false, updated_at: new Date() })
        .where(and(eq(conversations.id, id), eq(conversations.company_id, identity.companyId)))
        .returning();
      return updated ?? null;
    });
  },

  async createOrGetDm(identity: RequestIdentity, targetUserIds: string[]) {
    return withTenantTx(identity, async (tx: Db) => {
      const allUserIds = Array.from(new Set([identity.userId, ...targetUserIds])).sort();
      const isGroup = allUserIds.length > 2;

      // For 1:1 DMs, check if an existing DM already connects these 2 users
      if (!isGroup && allUserIds.length === 2) {
        const otherUserId = allUserIds.find((id) => id !== identity.userId)!;
        const candidateConvIds = await tx
          .select({ conversation_id: memberships.conversation_id })
          .from(memberships)
          .innerJoin(conversations, eq(conversations.id, memberships.conversation_id))
          .where(
            and(
              eq(conversations.type, "dm"),
              eq(conversations.company_id, identity.companyId),
              eq(memberships.user_id, identity.userId),
            ),
          );

        for (const c of candidateConvIds) {
          const [match] = await tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.conversation_id, c.conversation_id),
                eq(memberships.user_id, otherUserId),
              ),
            )
            .limit(1);
          if (match) {
            const [existing] = await tx
              .select()
              .from(conversations)
              .where(eq(conversations.id, c.conversation_id))
              .limit(1);
            if (existing) return { conversation: existing, created: false };
          }
        }
      }

      // Create new DM or Group DM
      const convType = isGroup ? "group_dm" : "dm";
      const [conv] = await tx
        .insert(conversations)
        .values({
          company_id: identity.companyId,
          type: convType,
          kind: null,
          name: null,
          member_count: allUserIds.length,
          created_by: identity.userId,
        })
        .returning();
      if (!conv) throw new Error("Failed to create DM conversation");

      for (const uid of allUserIds) {
        await tx.insert(memberships).values({
          conversation_id: conv.id,
          user_id: uid,
          company_id: identity.companyId,
          role: "member",
        });
      }

      await tx.execute(
        sql`INSERT INTO message_seq_counters (conversation_id, last_seq) VALUES (${conv.id}, 0)`,
      );

      return { conversation: conv, created: true };
    });
  },

  async listMembers(identity: RequestIdentity, conversationId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      return tx
        .select({
          id: memberships.id,
          conversation_id: memberships.conversation_id,
          user_id: memberships.user_id,
          company_id: memberships.company_id,
          role: memberships.role,
          last_read_message_id: memberships.last_read_message_id,
          notification_pref: memberships.notification_pref,
          is_muted: memberships.is_muted,
          joined_at: memberships.joined_at,
          user: {
            id: users.id,
            name: users.name,
            avatar_url: users.avatar_url,
          },
        })
        .from(memberships)
        .leftJoin(users, eq(users.id, memberships.user_id))
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.company_id, identity.companyId),
          ),
        );
    });
  },

  async addMember(
    identity: RequestIdentity,
    conversationId: string,
    input: { user_id: string; role?: "owner" | "admin" | "member" },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const [existing] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, input.user_id),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .limit(1);

      if (existing) return existing;

      const [member] = await tx
        .insert(memberships)
        .values({
          conversation_id: conversationId,
          user_id: input.user_id,
          company_id: identity.companyId,
          role: input.role ?? "member",
        })
        .returning();

      await tx
        .update(conversations)
        .set({ member_count: sql`member_count + 1`, updated_at: new Date() })
        .where(eq(conversations.id, conversationId));

      return member;
    });
  },

  async updateMember(
    identity: RequestIdentity,
    conversationId: string,
    userId: string,
    input: {
      role?: "owner" | "admin" | "member";
      notification_pref?: "all" | "mentions" | "nothing";
      is_muted?: boolean;
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const updateData: Partial<typeof memberships.$inferInsert> = {
        updated_at: new Date(),
      };
      if (input.role !== undefined) updateData.role = input.role;
      if (input.notification_pref !== undefined)
        updateData.notification_pref = input.notification_pref;
      if (input.is_muted !== undefined) updateData.is_muted = input.is_muted;

      const [updated] = await tx
        .update(memberships)
        .set(updateData)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, userId),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .returning();
      return updated ?? null;
    });
  },

  async removeMember(identity: RequestIdentity, conversationId: string, userId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const deleted = await tx
        .delete(memberships)
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.user_id, userId),
            eq(memberships.company_id, identity.companyId),
          ),
        )
        .returning();

      if (deleted.length > 0) {
        await tx
          .update(conversations)
          .set({ member_count: sql`GREATEST(0, member_count - 1)`, updated_at: new Date() })
          .where(eq(conversations.id, conversationId));
      }

      return deleted.length > 0;
    });
  },
};
