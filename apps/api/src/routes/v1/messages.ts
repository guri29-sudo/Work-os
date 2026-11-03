import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PERMISSIONS,
  encodeCursor,
  decodeCursor,
  SendMessageRequestSchema,
  EditMessageRequestSchema,
} from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { messagesRepo } from "../../repositories/messages.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { pubsub } from "../../pubsub/index.js";

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  direction: z.enum(["before", "after"]).default("before"),
});

const ThreadQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export default async function messageRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/conversations/:id/messages", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const q = ListQuery.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const seq = typeof cursorData?.seq === "number" ? cursorData.seq : undefined;

    const rows = await messagesRepo.list(identity, {
      conversationId,
      cursor: seq,
      limit: q.data.limit,
      direction: q.data.direction,
    });

    const hasMore = rows.length > q.data.limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    const last = items.at(-1);

    return reply.send({
      data: items,
      pageInfo: {
        hasNextPage: hasMore,
        endCursor: last ? encodeCursor({ seq: last.seq }) : null,
      },
    });
  });

  fastify.post("/v1/conversations/:id/messages", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MESSAGE_SEND);

    const body = SendMessageRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const { message, created } = await messagesRepo.send(identity, {
      conversationId,
      clientMsgId: body.data.client_msg_id,
      body: body.data.body,
      parentId: body.data.parent_id,
      attachmentIds: body.data.attachment_ids,
      mentionIds: body.data.mention_ids,
      objectReferences: body.data.object_references,
    });

    if (created) {
      void pubsub.publish(`company_${identity.companyId}_conv_${conversationId}`, {
        type: "message.created",
        v: 1,
        message,
        ts: new Date().toISOString(),
      });
    }

    return reply.status(created ? 201 : 200).send({ data: message, created });
  });

  fastify.get("/v1/conversations/:id/messages/:messageId/thread", async (request, reply) => {
    const { id: conversationId, messageId: parentId } = request.params as {
      id: string;
      messageId: string;
    };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({ error: { code: "NOT_A_MEMBER", message: "Not a member" } });
    }

    const q = ThreadQuery.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const seq = typeof cursorData?.seq === "number" ? cursorData.seq : undefined;

    const rows = await messagesRepo.listThreadReplies(identity, {
      conversationId,
      parentId,
      cursor: seq,
      limit: q.data.limit,
    });

    const hasMore = rows.length > q.data.limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    const last = items.at(-1);

    return reply.send({
      data: items,
      pageInfo: {
        hasNextPage: hasMore,
        endCursor: last ? encodeCursor({ seq: last.seq }) : null,
      },
    });
  });

  fastify.patch("/v1/conversations/:id/messages/:messageId", async (request, reply) => {
    const { id: conversationId, messageId } = request.params as { id: string; messageId: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MESSAGE_SEND);

    const body = EditMessageRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const updated = await messagesRepo.edit(identity, {
      conversationId,
      messageId,
      body: body.data.body,
    });

    if (!updated) {
      return reply
        .status(404)
        .send({ error: { code: "NOT_FOUND", message: "Message not found or not editable" } });
    }

    void pubsub.publish(`company_${identity.companyId}_conv_${conversationId}`, {
      type: "message.updated",
      v: 1,
      message: updated,
      ts: new Date().toISOString(),
    });

    return reply.send({ data: updated });
  });

  fastify.delete("/v1/conversations/:id/messages/:messageId", async (request, reply) => {
    const { id: conversationId, messageId } = request.params as { id: string; messageId: string };
    const identity = request.identity;

    const existing = await messagesRepo.getById(identity, messageId);
    if (!existing) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Message not found" } });
    }

    if (existing.author_id !== identity.userId) {
      policy.require(identity, PERMISSIONS.MESSAGE_MODERATE);
    } else {
      policy.require(identity, PERMISSIONS.MESSAGE_SEND);
    }

    const deleted = await messagesRepo.softDelete(identity, messageId, identity.userId);

    if (deleted) {
      void pubsub.publish(`company_${identity.companyId}_conv_${conversationId}`, {
        type: "message.deleted",
        v: 1,
        messageId,
        conversationId,
        ts: new Date().toISOString(),
      });
    }

    return reply.send({ data: { success: true } });
  });
}
