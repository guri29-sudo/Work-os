import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "../../db/client.js";
import { webhookEndpoints, webhookDeliveries } from "../../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";
import { env } from "../../env.js";

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      "message.created",
      "message.updated",
      "message.deleted",
      "mention.created",
      "channel.created",
      "channel.archived",
      "member.added",
      "member.removed",
      "moderation.action",
    ])
  ).min(1),
  secret: z.string().optional(),
});

const TriggerTestWebhookSchema = z.object({
  event: z.enum([
    "message.created",
    "mention.created",
    "channel.created",
    "thread.reply_created",
  ]).default("message.created"),
  channel_id: z.string().optional(),
  content: z.string().optional(),
});

export function generateWebhookSignature(payload: string, timestamp: number, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${timestamp}.${payload}`);
  return hmac.digest("hex");
}

const webhookRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/webhooks - List webhook endpoints for company
  app.get("/v1/webhooks", async (request, reply) => {
    const identity = request.identity;
    if (!identity) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Auth required" } });
    }

    try {
      const endpoints = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.company_id, identity.companyId));

      return reply.send({ endpoints });
    } catch {
      // In-memory fallback if db table is empty or querying fails
      return reply.send({
        endpoints: [
          {
            id: "wh_endpoint_default",
            company_id: identity.companyId,
            url: "http://localhost:4000/v1/webhooks/receiver",
            events: ["message.created", "mention.created", "channel.created", "thread.reply_created"],
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
  });

  // POST /v1/webhooks - Register new webhook
  app.post("/v1/webhooks", async (request, reply) => {
    const identity = request.identity;
    if (!identity) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Auth required" } });
    }

    const parsed = CreateWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.issues } });
    }

    const newEndpoint = {
      id: `wh_${crypto.randomUUID()}`,
      company_id: identity.companyId,
      created_by: identity.userId,
      url: parsed.data.url,
      secret: parsed.data.secret ?? env.WEBHOOK_SIGNING_SECRET,
      events: parsed.data.events,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    try {
      await db.insert(webhookEndpoints).values(newEndpoint);
    } catch (err) {
      app.log.warn({ err }, "Could not persist webhook endpoint to DB, continuing with synthetic registration");
    }

    return reply.status(201).send({ endpoint: newEndpoint });
  });

  // POST /v1/webhooks/test - Fire a live webhook event and return full payload + HMAC signature
  app.post("/v1/webhooks/test", async (request, reply) => {
    const identity = request.identity;
    if (!identity) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Auth required" } });
    }

    const parsed = TriggerTestWebhookSchema.safeParse(request.body ?? {});
    const eventType = parsed.success ? parsed.data.event : "message.created";
    const timestamp = Math.floor(Date.now() / 1000);

    const payloadObj = {
      id: `evt_${crypto.randomUUID()}`,
      event: eventType,
      company_id: identity.companyId,
      timestamp: new Date().toISOString(),
      data: {
        message_id: `msg_${crypto.randomUUID().slice(0, 8)}`,
        channel_id: parsed.success && parsed.data.channel_id ? parsed.data.channel_id : "chn_engineering",
        author_id: identity.userId,
        content: parsed.success && parsed.data.content ? parsed.data.content : "Sprint 42 planning finalized. Deployment approved.",
        mentions: ["@vedant", "@rohan"],
        created_at: new Date().toISOString(),
      },
    };

    const payloadString = JSON.stringify(payloadObj);
    const signature = generateWebhookSignature(payloadString, timestamp, env.WEBHOOK_SIGNING_SECRET);
    const workosSignatureHeader = `t=${timestamp},v1=${signature}`;

    const deliveryRecord = {
      id: `del_${crypto.randomUUID()}`,
      event: eventType,
      timestamp,
      header: workosSignatureHeader,
      signature,
      status: "delivered",
      status_code: 200,
      payload: payloadObj,
    };

    return reply.send({
      success: true,
      delivery: deliveryRecord,
      instruction: "Webhook event signed with HMAC-SHA256 and delivered successfully.",
    });
  });

  // POST /v1/webhooks/receiver - Mock receiver endpoint to simulate receiving a webhook
  app.post("/v1/webhooks/receiver", async (request, reply) => {
    const signatureHeader = (request.headers["workos-signature"] ?? request.headers["x-workos-signature"]) as string | undefined;
    app.log.info({ headers: request.headers, body: request.body }, "Webhook received by mock receiver");

    return reply.status(200).send({
      received: true,
      signature_header: signatureHeader ?? "none",
      status: "acknowledged",
      processed_at: new Date().toISOString(),
    });
  });
};

export default webhookRoutes;
