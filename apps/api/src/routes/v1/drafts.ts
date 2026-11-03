import type { FastifyInstance } from "fastify";
import { PERMISSIONS, SaveDraftRequestSchema } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { draftsRepo } from "../../repositories/drafts.js";
import { conversationsRepo } from "../../repositories/conversations.js";

export default async function draftRoutes(fastify: FastifyInstance) {
  fastify.put("/v1/conversations/:id/draft", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const body = SaveDraftRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const draft = await draftsRepo.save(identity, conversationId, body.data.body);
    return reply.send({ data: draft });
  });

  fastify.get("/v1/conversations/:id/draft", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const draft = await draftsRepo.get(identity, conversationId);
    return reply.send({ data: draft });
  });

  fastify.delete("/v1/conversations/:id/draft", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const success = await draftsRepo.delete(identity, conversationId);
    return reply.send({ data: { success } });
  });
}
