import { eq, and, ilike, sql } from "drizzle-orm";
import { users, memberships } from "../db/schema/index.js";
import { withTenantTx } from "./base.js";
import type { RequestIdentity } from "../auth/plugin.js";
import type { Db } from "./base.js";

export const usersRepo = {
  async getMe(identity: RequestIdentity) {
    return withTenantTx(identity, async (tx: Db) => {
      let [u] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, identity.userId), eq(users.company_id, identity.companyId)));

      if (!u) {
        // Auto-provision user record from validated token identity
        const [inserted] = await tx
          .insert(users)
          .values({
            id: identity.userId,
            company_id: identity.companyId,
            name: identity.name,
            avatar_url: identity.avatarUrl ?? null,
            department_ids: [],
            project_ids: [],
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              name: identity.name,
              avatar_url: identity.avatarUrl ?? null,
              updated_at: sql`now()`,
            },
          })
          .returning();
        u = inserted;
      }

      const companySlug = identity.companyId.includes("globex") ? "globex" : "acme";
      const companyName = identity.companyId.includes("globex") ? "Globex Corp" : "Acme Corp";

      return {
        id: u.id,
        company_id: u.company_id,
        name: u.name,
        avatar_url: u.avatar_url,
        department_ids: u.department_ids,
        project_ids: u.project_ids,
        permissions: identity.permissions,
        company: {
          id: u.company_id,
          name: companyName,
          slug: companySlug,
        },
      };
    });
  },

  async search(identity: RequestIdentity, q: string, limit = 20) {
    return withTenantTx(identity, async (tx: Db) => {
      const pattern = `%${q}%`;
      return tx
        .select({
          id: users.id,
          name: users.name,
          avatar_url: users.avatar_url,
        })
        .from(users)
        .where(and(eq(users.company_id, identity.companyId), ilike(users.name, pattern)))
        .limit(limit);
    });
  },

  async searchConversationMembers(
    identity: RequestIdentity,
    conversationId: string,
    q: string,
    limit = 20,
  ) {
    return withTenantTx(identity, async (tx: Db) => {
      const pattern = `%${q}%`;
      return tx
        .select({
          id: users.id,
          name: users.name,
          avatar_url: users.avatar_url,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(
          users,
          and(eq(users.id, memberships.user_id), eq(users.company_id, identity.companyId)),
        )
        .where(
          and(
            eq(memberships.conversation_id, conversationId),
            eq(memberships.company_id, identity.companyId),
            ilike(users.name, pattern),
          ),
        )
        .limit(limit);
    });
  },
};
