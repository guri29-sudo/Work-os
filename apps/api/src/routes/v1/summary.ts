import type { FastifyInstance } from "fastify";
import { PERMISSIONS, GenerateSummaryRequestSchema } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { summaryService, validateAndNormalizeRange } from "../../services/summary.js";

export default async function summaryRoutes(fastify: FastifyInstance) {
  const handler = async (request: any, reply: any) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const body = GenerateSummaryRequestSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: body.error.message },
      });
    }

    // Range validation
    const rangeCheck = validateAndNormalizeRange(body.data.from, body.data.to);
    if (!rangeCheck.valid) {
      return reply.status(400).send({
        error: { code: "INVALID_RANGE", message: rangeCheck.error },
      });
    }

    // Membership check (channels, DMs, group chats)
    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply.status(403).send({
        error: { code: "NOT_A_MEMBER", message: "You are not a member of this conversation." },
      });
    }

    try {
      const result = await summaryService.getOrGenerateSummary(
        identity,
        conversationId,
        body.data.from,
        body.data.to,
        body.data.regenerate ?? false
      );

      return reply.send({ ...result, data: result });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return reply.status(statusCode).send({
        error: {
          code: err.code || "SUMMARY_ERROR",
          message: err.message || "Failed to generate AI summary.",
        },
      });
    }
  };

  // Register both /v1/... and /api/... prefixes for maximum flexibility
  fastify.post("/v1/conversations/:id/summary", handler);
  fastify.post("/api/conversations/:id/summary", handler);
}

