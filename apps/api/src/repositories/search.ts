/**
 * Search Repository: Multi-tenant, membership-aware full-text search across messages.
 */
import { eq, and, sql, desc, lt, gt } from "drizzle-orm";
import { messages, conversations, memberships, users } from "../db/schema/index.js";
import { withTenantTx, type Db } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { SearchQuery } from "@cs/contracts";

export interface SearchResultItem {
  message: typeof messages.$inferSelect & {
    author?: {
      id: string;
      name: string;
      avatar_url: string | null;
    };
  };
  conversation: {
    id: string;
    name: string | null;
    type: "dm" | "group_dm" | "channel";
  };
  snippet: string;
}

export const searchRepo = {
  async search(
    identity: RequestIdentity,
    query: SearchQuery,
  ): Promise<SearchResultItem[]> {
    return withTenantTx(identity, async (tx: Db) => {
      const qTerm = `%${query.q.replace(/[%_]/g, "\\$&")}%`;

      const conditions = [
        eq(messages.company_id, identity.companyId),
        sql`${messages.deleted_at} IS NULL`,
        sql`${messages.body} ILIKE ${qTerm}`,
        // Tenant + membership security: user is member OR conversation is a public/company channel
        sql`(
          EXISTS (
            SELECT 1 FROM ${memberships} m
            WHERE m.conversation_id = ${messages.conversation_id}
              AND m.user_id = ${identity.userId}
          )
          OR EXISTS (
            SELECT 1 FROM ${conversations} c
            WHERE c.id = ${messages.conversation_id}
              AND c.company_id = ${identity.companyId}
              AND c.type = 'channel'
              AND c.kind IN ('public', 'company')
          )
        )`,
      ];

      if (query.conversation_id) {
        conditions.push(eq(messages.conversation_id, query.conversation_id));
      }

      if (query.author_id) {
        conditions.push(eq(messages.author_id, query.author_id));
      }

      if (query.has_file) {
        conditions.push(sql`cardinality(${messages.attachment_ids}) > 0`);
      }

      if (query.before) {
        conditions.push(lt(messages.created_at, new Date(query.before)));
      }

      if (query.after) {
        conditions.push(gt(messages.created_at, new Date(query.after)));
      }

      if (query.cursor) {
        conditions.push(lt(messages.id, query.cursor));
      }

      const rows = await tx
        .select({
          message: messages,
          conversation_id: conversations.id,
          conversation_name: conversations.name,
          conversation_type: conversations.type,
          author_id: users.id,
          author_name: users.name,
          author_avatar_url: users.avatar_url,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
        .leftJoin(users, eq(messages.author_id, users.id))
        .where(and(...conditions))
        .orderBy(desc(messages.created_at), desc(messages.id))
        .limit((query.limit ?? 20) + 1);

      return rows.map((row) => {
        const body = row.message.body;
        const lowerBody = body.toLowerCase();
        const lowerQ = query.q.toLowerCase();
        const idx = lowerBody.indexOf(lowerQ);

        let snippet: string;
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(body.length, idx + query.q.length + 40);
          const matched = body.slice(idx, idx + query.q.length);
          snippet = `${start > 0 ? "..." : ""}${body.slice(start, idx)}<mark>${matched}</mark>${body.slice(idx + query.q.length, end)}${end < body.length ? "..." : ""}`;
        } else {
          snippet = body.slice(0, 100);
        }

        return {
          message: {
            ...row.message,
            author: row.author_id
              ? {
                  id: row.author_id,
                  name: row.author_name ?? "Unknown",
                  avatar_url: row.author_avatar_url ?? null,
                }
              : undefined,
          },
          conversation: {
            id: row.conversation_id,
            name: row.conversation_name,
            type: row.conversation_type,
          },
          snippet,
        };
      });
    });
  },
};
