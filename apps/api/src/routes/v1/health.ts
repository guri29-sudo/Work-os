import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { sql } from "drizzle-orm";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", (_req, reply) => {
    void reply.send({ status: "ok", service: "communication-api" });
  });

  fastify.get("/health/live", (_req, reply) => {
    void reply.send({ status: "ok" });
  });

  fastify.get("/health/ready", async (_req, reply) => {
    try {
      await db.execute(sql`SELECT 1`);
      void reply.send({ status: "ok", db: "connected" });
    } catch {
      void reply.status(503).send({ status: "error", db: "disconnected" });
    }
  });
}
