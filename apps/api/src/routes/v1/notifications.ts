import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "@cs/contracts";
import { policy } from "../../policy/index.js";
import { notificationsRepo } from "../../repositories/notifications.js";

const ListQuery = z.object({
  is_read: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const CreateNotificationBody = z.object({
  user_id: z.string().uuid(),
  kind: z.string().min(1).max(50),
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
});

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/notifications", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const q = ListQuery.safeParse(request.query);
    if (!q.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: q.error.message } });
    }

    const [items, unreadCount] = await Promise.all([
      notificationsRepo.listForUser(identity, {
        isRead: q.data.is_read,
        limit: q.data.limit,
      }),
      notificationsRepo.getUnreadCount(identity),
    ]);

    return reply.send({
      data: items,
      unread_count: unreadCount,
    });
  });

  fastify.patch("/v1/notifications/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const updated = await notificationsRepo.markAsRead(identity, id);
    if (!updated) {
      return reply
        .status(404)
        .send({ error: { code: "NOT_FOUND", message: "Notification not found" } });
    }

    return reply.send({ data: updated });
  });

  fastify.post("/v1/notifications/read-all", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const count = await notificationsRepo.markAllAsRead(identity);
    return reply.send({ data: { marked_read_count: count } });
  });

  fastify.post("/v1/notifications", async (request, reply) => {
    const identity = request.identity;
    policy.require(identity, PERMISSIONS.ACCESS);

    const body = CreateNotificationBody.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
    }

    const created = await notificationsRepo.create(identity, {
      userId: body.data.user_id,
      kind: body.data.kind,
      conversationId: body.data.conversation_id,
      messageId: body.data.message_id,
      actorId: body.data.actor_id ?? identity.userId,
    });

    return reply.status(201).send({ data: created });
  });
}
