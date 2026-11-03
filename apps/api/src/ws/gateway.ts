/**
 * WebSocket gateway.
 *
 * Protocol:
 *  1. Client connects with ?token=<jwt> OR sends { type: "auth", token: "<jwt>" }
 *  2. Server replies { type: "auth_ack", userId, companyId } or closes with 4401
 *  3. Client subscribes: { type: "subscribe", conversationId, cursor?: number }
 *     - Server validates/ensures membership, then streams ServerEvents for that conversation
 *  4. Client unsubscribes: { type: "unsubscribe", conversationId }
 *  5. Client sends { type: "ping" } -> server replies { type: "pong" }
 *  6. On disconnect, all subscriptions are cleaned up
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { TokenClaimsSchema } from "@cs/contracts";
import { env } from "../env.js";
import { pubsub } from "../pubsub/index.js";
import { conversationsRepo } from "../repositories/conversations.js";
import type { RequestIdentity } from "../auth/plugin.js";

interface AuthMessage {
  type: "auth";
  token: string;
}
interface SubscribeMessage {
  type: "subscribe";
  conversationId: string;
  cursor?: number;
}
interface UnsubscribeMessage {
  type: "unsubscribe";
  conversationId: string;
}
interface PingMessage {
  type: "ping";
}
type ClientMessage = AuthMessage | SubscribeMessage | UnsubscribeMessage | PingMessage;

export default fp(async (fastify: FastifyInstance) => {
  const JWKS = createRemoteJWKSet(new URL(env.JWKS_URI));

  const handleConnection = (socket: any, req: FastifyRequest) => {
    let identity: RequestIdentity | null = null;
    const convSubs = new Map<string, () => void>();
    const AUTH_TIMEOUT_MS = 10_000;

    function send(data: unknown): void {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    }

    // Close if client doesn't auth within 10 seconds
    const authTimer = setTimeout(() => {
      if (!identity) {
        socket.close(4401, "Authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);

    const authenticateToken = async (rawToken: string) => {
      try {
        const { payload } = await jwtVerify(rawToken, JWKS, {
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          algorithms: ["RS256"],
          maxTokenAge: "15m",
        });
        const claims = TokenClaimsSchema.safeParse(payload);
        if (!claims.success) throw new Error("Invalid claims");
        identity = {
          userId: claims.data.sub,
          companyId: claims.data.company_id,
          permissions: claims.data.permissions,
          name: claims.data.name,
          avatarUrl: claims.data.avatar_url ?? null,
        };
        clearTimeout(authTimer);
        send({ type: "auth_ack", userId: identity.userId, companyId: identity.companyId });
        return true;
      } catch {
        socket.close(4401, "Authentication failed");
        return false;
      }
    };

    // Auto-authenticate if token passed in URL query
    const query = req.query as Record<string, string | undefined>;
    if (query?.token) {
      void authenticateToken(query.token);
    }

    socket.on("message", (raw: Buffer | string) => {
      void (async () => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
          send({ type: "error", code: "INVALID_JSON" });
          return;
        }

        // -- auth ----------------------------------------------------------------
        if (msg.type === "auth") {
          if (identity) {
            send({ type: "error", code: "ALREADY_AUTHED" });
            return;
          }
          await authenticateToken(msg.token);
          return;
        }

        if (!identity) {
          send({ type: "error", code: "NOT_AUTHENTICATED" });
          return;
        }

        // -- subscribe ------------------------------------------------------------
        if (msg.type === "subscribe") {
          // If already subscribed, acknowledge immediately
          if (convSubs.has(msg.conversationId)) {
            send({ type: "subscribed", conversationId: msg.conversationId, cursor: msg.cursor ?? 0 });
            return;
          }

          // Ensure membership (auto-joins if public/company channel)
          await conversationsRepo.ensureMembership(identity, msg.conversationId);
          const isMember = await conversationsRepo.isMember(identity, msg.conversationId);
          if (!isMember) {
            console.warn(`[WS Server] Subscription rejected (not member): conv=${msg.conversationId} user=${identity.name} (${identity.userId})`);
            send({ type: "error", code: "NOT_A_MEMBER", conversationId: msg.conversationId });
            return;
          }

          const channel = `company_${identity.companyId}_conv_${msg.conversationId}`;
          const unsub = await pubsub.subscribe(channel, (event) => {
            send(event);
          });
          convSubs.set(msg.conversationId, unsub);
          console.log(`[WS Server] Subscribed: conv=${msg.conversationId} user=${identity.name} (${identity.userId})`);
          send({ type: "subscribed", conversationId: msg.conversationId, cursor: msg.cursor ?? 0 });
          return;
        }

        // -- unsubscribe ----------------------------------------------------------
        if (msg.type === "unsubscribe") {
          const unsub = convSubs.get(msg.conversationId);
          if (unsub) {
            unsub();
            convSubs.delete(msg.conversationId);
            console.log(`[WS Server] Unsubscribed: conv=${msg.conversationId} user=${identity.name}`);
          }
          send({ type: "unsubscribed", conversationId: msg.conversationId });
          return;
        }

        // -- ping -----------------------------------------------------------------
        if (msg.type === "ping") {
          send({ type: "pong", ts: Date.now() });
          return;
        }
      })();
    });

    socket.on("close", () => {
      clearTimeout(authTimer);
      for (const unsub of convSubs.values()) unsub();
      convSubs.clear();
    });

    socket.on("error", () => {
      clearTimeout(authTimer);
      for (const unsub of convSubs.values()) unsub();
      convSubs.clear();
    });
  };

  fastify.get("/v1/ws", { websocket: true }, handleConnection);
  fastify.get("/ws", { websocket: true }, handleConnection);
});
