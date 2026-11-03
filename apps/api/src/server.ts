/**
 * Fastify application factory.
 * Import and call buildApp() for tests; call start() for production.
 */
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { env } from "./env.js";
import authPlugin from "./auth/plugin.js";
import wsGateway from "./ws/gateway.js";
import healthRoutes from "./routes/v1/health.js";
import channelRoutes from "./routes/v1/channels.js";
import membershipRoutes from "./routes/v1/memberships.js";
import dmRoutes from "./routes/v1/dms.js";
import messageRoutes from "./routes/v1/messages.js";
import reactionRoutes from "./routes/v1/reactions.js";
import readStateRoutes from "./routes/v1/readState.js";
import draftRoutes from "./routes/v1/drafts.js";
import userRoutes from "./routes/v1/users.js";
import notificationRoutes from "./routes/v1/notifications.js";
import auditRoutes from "./routes/v1/audit.js";
import searchRoutes from "./routes/v1/search.js";
import attachmentRoutes from "./routes/v1/attachments.js";
import webhookRoutes from "./routes/v1/webhooks.js";
import idpRoutes from "./routes/idp.js";
import { pubsub } from "./pubsub/index.js";
import { verifyAppUserRole } from "./db/verifyRole.js";

export async function buildApp(opts?: { testing?: boolean }) {
  const app = Fastify({
    logger: opts?.testing
      ? false
      : {
          level: env.LOG_LEVEL,
          transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
        },
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // -- Security headers -----------------------------------------------------
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // handled by host app
  });

  // -- CORS ------------------------------------------------------------------
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // -- Rate limiting ---------------------------------------------------------
  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (req) => req.identity?.userId ?? req.ip,
    skipOnError: true,
  });

  // -- WebSocket -------------------------------------------------------------
  await app.register(fastifyWebsocket);

  // -- Auth plugin (JWKS verification, injects request.identity) ------------
  await app.register(authPlugin);

  // -- OpenAPI Swagger -------------------------------------------------------
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Communication System API",
        description: "Fastify HTTP + WebSocket backend API",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${env.API_PORT}`, description: "Local development" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // -- Error handler ---------------------------------------------------------
  app.setErrorHandler((err, request, reply) => {
    const statusCode = err.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error({ err, requestId: request.id }, "Unhandled error");
    }
    return reply.status(statusCode).send({
      error: {
        code: err.code ?? "INTERNAL_ERROR",
        message: statusCode < 500 ? err.message : "Internal server error",
        requestId: request.id,
      },
    });
  });

  // -- Root Dashboard -------------------------------------------------------
  app.get("/", async (req, reply) => {
    const isBrowser = (req.headers.accept ?? "").includes("text/html");
    if (!isBrowser) {
      return reply.send({
        service: "WorkOS Communication System API",
        status: "operational",
        documentation: "/documentation",
        health: "/health/ready",
        frontend: "http://localhost:5173",
      });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WorkOS Communication Backend API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; }
    .card { max-width: 680px; margin: 0 auto; background: white; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); padding: 36px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: #ecfdf5; color: #065f46; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    h1 { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #0a1a36; }
    p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 24px 0; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; margin-bottom: 28px; }
    .btn:hover { background: #1d4ed8; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 12px; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .list a { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f1f5f9; border-radius: 10px; color: #1e293b; text-decoration: none; font-size: 13px; font-family: monospace; font-weight: 600; transition: background 0.15s; }
    .list a:hover { background: #e2e8f0; color: #0f172a; }
    .note { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> Operational (Port ${env.API_PORT})</div>
    <h1>WorkOS Communication Backend API</h1>
    <p>Fastify REST & WebSocket gateway backed by PostgreSQL 18 with Row-Level Security, direct-to-storage attachments, and signed webhooks.</p>
    <a href="http://localhost:5173" class="btn">🚀 Open Main Application (http://localhost:5173) &rarr;</a>
    <div class="section-title">API Documentation & Endpoints</div>
    <ul class="list">
      <li><a href="/documentation" target="_blank"><span>📚 Interactive OpenAPI Swagger UI</span><span>/documentation &rarr;</span></a></li>
      <li><a href="/health/ready" target="_blank"><span>💓 Database Connection Health</span><span>/health/ready &rarr;</span></a></li>
      <li><a href="/health/live" target="_blank"><span>⚡ API Liveness Probe</span><span>/health/live &rarr;</span></a></li>
    </ul>
    <div class="note">WorkOS Internal Communication System · Monorepo Backend Service</div>
  </div>
</body>
</html>`;

    return reply.type("text/html").send(html);
  });

  // -- Routes ----------------------------------------------------------------
  await app.register(healthRoutes);
  await app.register(channelRoutes);
  await app.register(membershipRoutes);
  await app.register(dmRoutes);
  await app.register(messageRoutes);
  await app.register(reactionRoutes);
  await app.register(readStateRoutes);
  await app.register(draftRoutes);
  await app.register(userRoutes);
  await app.register(notificationRoutes);
  await app.register(auditRoutes);
  await app.register(searchRoutes);
  await app.register(attachmentRoutes);
  await app.register(webhookRoutes);
  await app.register(idpRoutes);
  await app.register(wsGateway);

  // -- Lifecycle: connect pubsub and verify app_user on start ---------------
  if (!opts?.testing) {
    app.addHook("onReady", async () => {
      await verifyAppUserRole();
      await pubsub.connect();
    });
    app.addHook("onClose", async () => {
      await pubsub.close();
    });
  }

  return app;
}

export async function start() {
  await verifyAppUserRole();
  const app = await buildApp();
  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(`API running on ${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
