import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { usersRepo } from "../../repositories/users.js";
import { conversationsRepo } from "../../repositories/conversations.js";

const SearchQuery = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/me", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const me = await usersRepo.getMe(identity);
    return reply.send({ data: me });
  });

  fastify.get("/v1/users/search", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const q = SearchQuery.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const results = await usersRepo.search(identity, q.data.q, q.data.limit);
    return reply.send({ data: results });
  });

  fastify.get("/v1/conversations/:id/members/search", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const q = SearchQuery.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const results = await usersRepo.searchConversationMembers(
      identity,
      conversationId,
      q.data.q,
      q.data.limit,
    );
    return reply.send({ data: results });
  });
}
