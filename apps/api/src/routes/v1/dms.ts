import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PERMISSIONS, CreateDmRequestSchema, encodeCursor, decodeCursor } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { auditRepo } from "../../repositories/audit.js";

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export default async function dmRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/dms", async (request, reply) => {
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
    });

    const dmRows = rows.filter((r) => r.type === "dm" || r.type === "group_dm");
    const hasNext = dmRows.length > q.data.limit;
    const items = hasNext ? dmRows.slice(0, -1) : dmRows;
    const last = items.at(-1);

    return reply.send({
      data: items,
      pageInfo: {
        hasNextPage: hasNext,
        endCursor: last ? encodeCursor({ id: last.id }) : null,
      },
    });
  });

  fastify.post("/v1/dms", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const body = CreateDmRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const { conversation, created } = await conversationsRepo.createOrGetDm(
      identity,
      body.data.user_ids,
    );

    if (created) {
      await auditRepo.write(identity, {
        action: "channel.created",
        resourceType: "conversation",
        resourceId: conversation.id,
        metadata: { type: conversation.type, userIds: body.data.user_ids },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
    }

    return reply.status(created ? 201 : 200).send({ data: conversation, created });
  });
}
