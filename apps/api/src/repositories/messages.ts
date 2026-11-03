import { eq, and, lt, gt, desc, asc, isNull, sql } from "drizzle-orm";
import {
  messages,
  messageSeqCounters,
  conversations,
  messageMentions,
  notifications,
  objectReferences,
  users,
} from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export interface ObjectReferenceInput {
  object_type: string;
  object_id: string;
  display_title: string;
  display_subtitle?: string | null;
}

export interface SendMessageInput {
  conversationId: string;
  clientMsgId: string;
  body: string;
  parentId?: string;
  attachmentIds?: string[];
  mentionIds?: string[];
  objectReferences?: ObjectReferenceInput[];
}

export interface SendMessageResult {
  message: typeof messages.$inferSelect & {
    object_references?: (typeof objectReferences.$inferSelect)[];
  };
  created: boolean;
}

export const messagesRepo = {
  async send(identity: RequestIdentity, input: SendMessageInput): Promise<SendMessageResult> {
    return withTenantTx(identity, async (tx: Db) => {
      const existing = await tx
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.author_id, identity.userId),
            eq(messages.conversation_id, input.conversationId),
            eq(messages.client_msg_id, input.clientMsgId),
            eq(messages.company_id, identity.companyId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return { message: existing[0], created: false };
      }

      const [counter] = await tx
        .update(messageSeqCounters)
        .set({ last_seq: sql`last_seq + 1` })
        .where(eq(messageSeqCounters.conversation_id, input.conversationId))
        .returning({ last_seq: messageSeqCounters.last_seq });

      if (!counter) {
        throw new Error(`No seq counter for conversation ${input.conversationId}`);
      }

      // Extract mention IDs from body (@UUID) and combine with explicit mentionIds
      const extractedMentionIds = new Set<string>(input.mentionIds ?? []);
      const mentionMatches = input.body.match(/@([a-f0-9-]{36})/gi);
      if (mentionMatches) {
        for (const m of mentionMatches) {
          const uId = m.slice(1);
          if (uId !== identity.userId) {
            extractedMentionIds.add(uId);
          }
        }
      }
      extractedMentionIds.delete(identity.userId);
      const finalMentionIds = Array.from(extractedMentionIds);

      const [msg] = await tx
        .insert(messages)
        .values({
          conversation_id: input.conversationId,
          company_id: identity.companyId,
          author_id: identity.userId,
          client_msg_id: input.clientMsgId,
          seq: counter.last_seq,
          body: input.body,
          parent_id: input.parentId ?? null,
          attachment_ids: input.attachmentIds ?? [],
          mention_ids: finalMentionIds,
          object_reference_ids: [],
        })
        .returning();

      if (!msg) throw new Error("Failed to insert message");

      // Handle object references
      const createdRefs: (typeof objectReferences.$inferSelect)[] = [];
      const objRefIds: string[] = [];
      if (input.objectReferences && input.objectReferences.length > 0) {
        for (const ref of input.objectReferences) {
          const [insertedRef] = await tx
            .insert(objectReferences)
            .values({
              company_id: identity.companyId,
              message_id: msg.id,
              object_type: ref.object_type,
              object_id: ref.object_id,
              display_title: ref.display_title,
              display_subtitle: ref.display_subtitle ?? null,
            })
            .returning();
          if (insertedRef) {
            createdRefs.push(insertedRef);
            objRefIds.push(insertedRef.id);
          }
        }
        if (objRefIds.length > 0) {
          await tx
            .update(messages)
            .set({ object_reference_ids: objRefIds })
            .where(eq(messages.id, msg.id));
          msg.object_reference_ids = objRefIds;
        }
      }

      // Record mentions & create notifications
      for (const mUserId of finalMentionIds) {
        await tx
          .insert(messageMentions)
          .values({
            company_id: identity.companyId,
            conversation_id: input.conversationId,
            message_id: msg.id,
            user_id: mUserId,
          })
          .onConflictDoNothing();

        await tx.insert(notifications).values({
          user_id: mUserId,
          company_id: identity.companyId,
          kind: "mention",
          conversation_id: input.conversationId,
          message_id: msg.id,
          actor_id: identity.userId,
          is_read: false,
        });
      }

      await tx
        .update(conversations)
        .set({ last_message_at: msg.created_at, updated_at: msg.created_at })
        .where(eq(conversations.id, input.conversationId));

      return {
        message: {
          ...msg,
          object_references: createdRefs,
          author: {
            id: identity.userId,
            name: identity.name,
            avatar_url: identity.avatarUrl ?? null,
          },
        },
        created: true,
      };
    });
  },

  async list(
    identity: RequestIdentity,
    opts: {
      conversationId: string;
      cursor?: number;
      limit: number;
      direction: "before" | "after";
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(messages.conversation_id, opts.conversationId),
        eq(messages.company_id, identity.companyId),
        isNull(messages.deleted_at),
        isNull(messages.parent_id), // top-level messages only in main list
      ];
      if (opts.cursor !== undefined) {
        if (opts.direction === "before") {
          conditions.push(lt(messages.seq, opts.cursor));
        } else {
          conditions.push(gt(messages.seq, opts.cursor));
        }
      }
      const order = opts.direction === "before" ? desc(messages.seq) : asc(messages.seq);

      const rows = await tx
        .select({
          id: messages.id,
          conversation_id: messages.conversation_id,
          company_id: messages.company_id,
          author_id: messages.author_id,
          client_msg_id: messages.client_msg_id,
          seq: messages.seq,
          body: messages.body,
          parent_id: messages.parent_id,
          attachment_ids: messages.attachment_ids,
          mention_ids: messages.mention_ids,
          object_reference_ids: messages.object_reference_ids,
          edited_at: messages.edited_at,
          deleted_at: messages.deleted_at,
          deleted_by: messages.deleted_by,
          created_at: messages.created_at,
          author_name: users.name,
          author_avatar_url: users.avatar_url,
        })
        .from(messages)
        .leftJoin(users, eq(messages.author_id, users.id))
        .where(and(...conditions))
        .orderBy(order)
        .limit(opts.limit + 1);

      const mapped = rows.map((r) => ({
        ...r,
        author: r.author_id
          ? {
              id: r.author_id,
              name: r.author_name ?? "Team Member",
              avatar_url: r.author_avatar_url ?? null,
            }
          : undefined,
      }));

      return opts.direction === "before" ? mapped.reverse() : mapped;
    });
  },

  async listThreadReplies(
    identity: RequestIdentity,
    opts: {
      conversationId: string;
      parentId: string;
      cursor?: number;
      limit: number;
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const conditions = [
        eq(messages.conversation_id, opts.conversationId),
        eq(messages.parent_id, opts.parentId),
        eq(messages.company_id, identity.companyId),
        isNull(messages.deleted_at),
      ];
      if (opts.cursor !== undefined) {
        conditions.push(gt(messages.seq, opts.cursor));
      }

      const rows = await tx
        .select({
          id: messages.id,
          conversation_id: messages.conversation_id,
          company_id: messages.company_id,
          author_id: messages.author_id,
          client_msg_id: messages.client_msg_id,
          seq: messages.seq,
          body: messages.body,
          parent_id: messages.parent_id,
          attachment_ids: messages.attachment_ids,
          mention_ids: messages.mention_ids,
          object_reference_ids: messages.object_reference_ids,
          edited_at: messages.edited_at,
          deleted_at: messages.deleted_at,
          deleted_by: messages.deleted_by,
          created_at: messages.created_at,
          author_name: users.name,
          author_avatar_url: users.avatar_url,
        })
        .from(messages)
        .leftJoin(users, eq(messages.author_id, users.id))
        .where(and(...conditions))
        .orderBy(asc(messages.seq))
        .limit(opts.limit + 1);

      return rows.map((r) => ({
        ...r,
        author: r.author_id
          ? {
              id: r.author_id,
              name: r.author_name ?? "Team Member",
              avatar_url: r.author_avatar_url ?? null,
            }
          : undefined,
      }));
    });
  },

  async edit(
    identity: RequestIdentity,
    opts: {
      messageId: string;
      conversationId: string;
      body: string;
    },
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const [updated] = await tx
        .update(messages)
        .set({
          body: opts.body,
          edited_at: new Date(),
        })
        .where(
          and(
            eq(messages.id, opts.messageId),
            eq(messages.conversation_id, opts.conversationId),
            eq(messages.company_id, identity.companyId),
            eq(messages.author_id, identity.userId),
            isNull(messages.deleted_at),
          ),
        )
        .returning();
      return updated ?? null;
    });
  },

  async getById(identity: RequestIdentity, id: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const rows = await tx
        .select({
          id: messages.id,
          conversation_id: messages.conversation_id,
          company_id: messages.company_id,
          author_id: messages.author_id,
          client_msg_id: messages.client_msg_id,
          seq: messages.seq,
          body: messages.body,
          parent_id: messages.parent_id,
          attachment_ids: messages.attachment_ids,
          mention_ids: messages.mention_ids,
          object_reference_ids: messages.object_reference_ids,
          edited_at: messages.edited_at,
          deleted_at: messages.deleted_at,
          deleted_by: messages.deleted_by,
          created_at: messages.created_at,
          author_name: users.name,
          author_avatar_url: users.avatar_url,
        })
        .from(messages)
        .leftJoin(users, eq(messages.author_id, users.id))
        .where(and(eq(messages.id, id), eq(messages.company_id, identity.companyId)))
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      return {
        ...r,
        author: r.author_id
          ? {
              id: r.author_id,
              name: r.author_name ?? "Team Member",
              avatar_url: r.author_avatar_url ?? null,
            }
          : undefined,
      };
    });
  },

  async getObjectReferences(identity: RequestIdentity, messageId: string) {
    return withTenantTx(identity, async (tx: Db) => {
      return tx
        .select()
        .from(objectReferences)
        .where(
          and(
            eq(objectReferences.message_id, messageId),
            eq(objectReferences.company_id, identity.companyId),
          ),
        );
    });
  },

  async softDelete(identity: RequestIdentity, messageId: string, deletedBy: string) {
    return withTenantTx(identity, async (tx: Db) => {
      const now = new Date();
      const [updated] = await tx
        .update(messages)
        .set({ deleted_at: now, deleted_by: deletedBy })
        .where(
          and(
            eq(messages.id, messageId),
            eq(messages.company_id, identity.companyId),
            isNull(messages.deleted_at),
          ),
        )
        .returning();
      return updated ?? null;
    });
  },
};
