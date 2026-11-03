import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PERMISSIONS, encodeCursor, decodeCursor } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { auditRepo } from "../../repositories/audit.js";

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/audit-log", async (request, reply) => {
    const q = ListQuery.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const identity = request.identity;
    policy.require(identity, PERMISSIONS.AUDIT_READ);

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const rows = await auditRepo.list(identity, {
      cursor: cursorData?.id as string | undefined,
      limit: q.data.limit,
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
}
