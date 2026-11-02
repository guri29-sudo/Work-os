import type { FastifyInstance } from "fastify";
import { SearchQuerySchema, PERMISSIONS, encodeCursor, decodeCursor } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { searchRepo } from "../../repositories/search.js";

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/search", async (request, reply) => {
    const q = SearchQuerySchema.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const cursorData = q.data.cursor ? decodeCursor(q.data.cursor) : undefined;
    const query = {
      ...q.data,
      cursor: cursorData?.id as string | undefined,
    };

    const limit = q.data.limit ?? 20;
    const rows = await searchRepo.search(identity, query);

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, -1) : rows;
    const last = items.at(-1);

    return reply.send({
      items,
      pageInfo: {
        hasNextPage: hasNext,
        hasPreviousPage: !!q.data.cursor,
        endCursor: last ? encodeCursor({ id: last.message.id }) : null,
        startCursor: items[0] ? encodeCursor({ id: items[0].message.id }) : null,
      },
    });
  });
}
