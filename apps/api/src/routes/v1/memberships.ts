import type { FastifyInstance } from "fastify";
import { PERMISSIONS, AddMemberRequestSchema, UpdateMemberRequestSchema } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { auditRepo } from "../../repositories/audit.js";

export default async function membershipRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/conversations/:id/members", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const isMember = await conversationsRepo.isMember(identity, conversationId);
    if (!isMember) {
      return reply
        .status(403)
        .send({ error: { code: "NOT_A_MEMBER", message: "Not a member of this conversation" } });
    }

    const members = await conversationsRepo.listMembers(identity, conversationId);
    return reply.send({ data: members });
  });

  fastify.post("/v1/conversations/:id/members", async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.MEMBER_MANAGE);

    const body = AddMemberRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const member = await conversationsRepo.addMember(identity, conversationId, body.data);

    await auditRepo.write(identity, {
      action: "member.added",
      resourceType: "membership",
      resourceId: member.id,
      metadata: { conversationId, userId: body.data.user_id, role: body.data.role },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(201).send({ data: member });
  });

  fastify.patch("/v1/conversations/:id/members/:userId", async (request, reply) => {
    const { id: conversationId, userId: targetUserId } = request.params as {
      id: string;
      userId: string;
    };
    const identity = request.identity;

    const body = UpdateMemberRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    // Role modification requires MEMBER_MANAGE; self notification updates do not
    if (body.data.role !== undefined) {
      policy.require(identity, PERMISSIONS.MEMBER_MANAGE);
    } else {
      policy.require(identity, PERMISSIONS.ACCESS);
      if (identity.userId !== targetUserId) {
        policy.require(identity, PERMISSIONS.MEMBER_MANAGE);
      }
    }

    const updated = await conversationsRepo.updateMember(
      identity,
      conversationId,
      targetUserId,
      body.data,
    );
    if (!updated) {
      return reply
        .status(404)
        .send({ error: { code: "NOT_FOUND", message: "Membership not found" } });
    }

    return reply.send({ data: updated });
  });

  fastify.delete("/v1/conversations/:id/members/:userId", async (request, reply) => {
    const { id: conversationId, userId: targetUserId } = request.params as {
      id: string;
      userId: string;
    };
    const identity = request.identity;

    if (identity.userId !== targetUserId) {
      policy.require(identity, PERMISSIONS.MEMBER_MANAGE);
    } else {
      policy.require(identity, PERMISSIONS.ACCESS);
    }

    const removed = await conversationsRepo.removeMember(identity, conversationId, targetUserId);
    if (!removed) {
      return reply
        .status(404)
        .send({ error: { code: "NOT_FOUND", message: "Membership not found" } });
    }

    return reply.send({ data: { success: true } });
  });
}
