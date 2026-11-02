import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { TokenClaimsSchema } from "@cs/contracts";
import { env } from "../env.js";

export interface RequestIdentity {
  userId: string;
  companyId: string;
  permissions: string[];
  name: string;
  avatarUrl: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    identity: RequestIdentity;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const JWKS = createRemoteJWKSet(new URL(env.JWKS_URI));

  async function verifyToken(request: FastifyRequest): Promise<void> {
    if (env.NODE_ENV === "test" && request.headers["x-test-identity"]) {
      try {
        request.identity = JSON.parse(
          request.headers["x-test-identity"] as string,
        ) as RequestIdentity;
        return;
      } catch {
        // fallback to standard token verification
      }
    }
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      const err = Object.assign(new Error("Missing Bearer token"), { statusCode: 401 });
      throw err;
    }
    const token = authHeader.slice(7);

    let payload: unknown;
    try {
      const result = await jwtVerify(token, JWKS, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ["RS256"],
        maxTokenAge: "15m",
      });
      payload = result.payload;
    } catch (e) {
      const err = Object.assign(
        new Error(`Token invalid: ${e instanceof Error ? e.message : String(e)}`),
        { statusCode: 401 },
      );
      throw err;
    }

    const claims = TokenClaimsSchema.safeParse(payload);
    if (!claims.success) {
      throw Object.assign(new Error("Token claims invalid"), { statusCode: 401 });
    }

    request.identity = {
      userId: claims.data.sub,
      companyId: claims.data.company_id,
      permissions: claims.data.permissions,
      name: claims.data.name,
      avatarUrl: claims.data.avatar_url ?? null,
    };
  }

  fastify.decorate("authenticate", verifyToken);

  fastify.addHook("onRequest", async (request) => {
    const path = request.url.split("?")[0] ?? "";
    if (
      path === "/" ||
      path.startsWith("/health") ||
      path.startsWith("/v1/health") ||
      path.startsWith("/ws") ||
      path.startsWith("/v1/ws") ||
      path.startsWith("/documentation") ||
      path.startsWith("/v1/webhooks/receiver")
    ) {
      return;
    }
    await verifyToken(request);
  });
});
