import type { FastifyInstance } from "fastify";
import { PERMISSIONS, AddReactionRequestSchema } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { reactionsRepo } from "../../repositories/reactions.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { messagesRepo } from "../../repositories/messages.js";
import { pubsub } from "../../pubsub/index.js";

export default async function reactionRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/conversations/:id/messages/:messageId/reactions", async (request, reply) => {
    const { id: conversationId, messageId } = request.params as { id: string; messageId: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const summary = await reactionsRepo.listForMessage(identity, messageId);
    return reply.send({ data: summary });
  });

  fastify.post("/v1/conversations/:id/messages/:messageId/reactions", async (request, reply) => {
    const { id: conversationId, messageId } = request.params as { id: string; messageId: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MESSAGE_SEND);

    const body = AddReactionRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const msg = await messagesRepo.getById(identity, messageId);
    if (!msg) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Message not found" } });
    }

    const r = await reactionsRepo.add(identity, {
      conversationId,
      messageId,
      emoji: body.data.emoji,
    });

    void pubsub.publish(`company_${identity.companyId}_conv_${conversationId}`, {
      type: "reaction.added",
      v: 1,
      messageId,
      userId: identity.userId,
      emoji: body.data.emoji,
      ts: new Date().toISOString(),
    });

    return reply.status(201).send({ data: r ?? { message_id: messageId, emoji: body.data.emoji } });
  });

  fastify.delete(
    "/v1/conversations/:id/messages/:messageId/reactions/:emoji",
    async (request, reply) => {
      const {
        id: conversationId,
        messageId,
        emoji,
      } = request.params as { id: string; messageId: string; emoji: string };
      const identity = request.identity;
      policy.require(identity, PERMISSIONS.MESSAGE_SEND);

      const decodedEmoji = decodeURIComponent(emoji);
      const success = await reactionsRepo.remove(identity, {
        conversationId,
        messageId,
        emoji: decodedEmoji,
      });

      if (success) {
        void pubsub.publish(`company_${identity.companyId}_conv_${conversationId}`, {
          type: "reaction.removed",
          v: 1,
          messageId,
          userId: identity.userId,
          emoji: decodedEmoji,
          ts: new Date().toISOString(),
        });
      }

      return reply.send({ data: { success } });
    },
  );
}
