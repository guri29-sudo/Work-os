import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PERMISSIONS,
  encodeCursor,
  decodeCursor,
  CreateChannelRequestSchema,
  UpdateChannelRequestSchema,
} from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { auditRepo } from "../../repositories/audit.js";

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export default async function channelRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/channels", async (request, reply) => {
    const q = ListQuery.safeParse(request.query);
    if (!q.success)
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });

    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const rows = await conversationsRepo.listForUser(identity, {
      cursor: cursorData?.id as string | undefined,
      limit: q.data.limit,
      type: "channel",
    });

    const hasNext = rows.length > q.data.limit;
    const items = hasNext ? rows.slice(0, -1) : rows;
    const last = items.at(-1);

    return reply.send({
      data: items,
      pageInfo: {
        hasNextPage: hasNext,
        endCursor: last ? encodeCursor({ id: last.id }) : null,
      },
    });
  });

  fastify.post("/v1/channels", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const body = CreateChannelRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    if (body.data.kind === "private") {
      policy.require(identity, PERMISSIONS.PRIVATE_CHANNEL_CREATE);
    } else {
      policy.require(identity, PERMISSIONS.CHANNEL_CREATE);
    }

    const conv = await conversationsRepo.createChannel(identity, body.data);

    await auditRepo.write(identity, {
      action: "channel.created",
      resourceType: "conversation",
      resourceId: conv.id,
      metadata: { name: body.data.name, kind: body.data.kind },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(201).send({ data: conv });
  });

  fastify.get("/v1/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const conv = await conversationsRepo.getById(identity, id);
    if (!conv)
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Channel not found" } });
    return reply.send({ data: conv });
  });

  fastify.patch("/v1/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.CHANNEL_MANAGE);

    const body = UpdateChannelRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const updated = await conversationsRepo.updateChannel(identity, id, body.data);
    if (!updated) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Channel not found" } });
    }

    await auditRepo.write(identity, {
      action: "channel.updated",
      resourceType: "conversation",
      resourceId: id,
      metadata: body.data,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ data: updated });
  });

  fastify.post("/v1/channels/:id/archive", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.CHANNEL_MANAGE);

    const archived = await conversationsRepo.archiveChannel(identity, id);
    if (!archived) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Channel not found" } });
    }

    await auditRepo.write(identity, {
      action: "channel.archived",
      resourceType: "conversation",
      resourceId: id,
      metadata: { is_archived: true },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ data: archived });
  });

  fastify.post("/v1/channels/:id/unarchive", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.CHANNEL_MANAGE);

    const unarchived = await conversationsRepo.unarchiveChannel(identity, id);
    if (!unarchived) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Channel not found" } });
    }

    await auditRepo.write(identity, {
      action: "channel.unarchived",
      resourceType: "conversation",
      resourceId: id,
      metadata: { is_archived: false },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ data: unarchived });
  });
}
