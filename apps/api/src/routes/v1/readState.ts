import type { FastifyInstance } from "fastify";
import { PERMISSIONS, MarkReadRequestSchema } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { readStateRepo } from "../../repositories/readState.js";
import { conversationsRepo } from "../../repositories/conversations.js";

export default async function readStateRoutes(fastify: FastifyInstance) {
  fastify.post("/v1/conversations/:id/read", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const body = MarkReadRequestSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const result = await readStateRepo.markRead(
      identity,
      conversationId,
      body.data.last_read_message_id,
    );
    return reply.send({ data: result });
  });

  fastify.get("/v1/conversations/:id/unread", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const unread = await readStateRepo.getUnreadCount(identity, conversationId);
    return reply.send({ data: unread });
  });

  fastify.get("/v1/unread", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const unreads = await readStateRepo.listAllUnreads(identity);
    return reply.send({ data: unreads });
  });
}
