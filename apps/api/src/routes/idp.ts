/**
 * Built-in Mock IdP Routes for standalone/demo deployments.
 * Enables the API service to host its own JWKS and issue demo JWTs on the same URL.
 */
import type { FastifyInstance } from "fastify";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { randomUUID, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { ALL_USERS, findUserById, COMPANY_ACME, COMPANY_GLOBEX } from "@cs/test-fixtures";
import { ROLE_DEFAULTS } from "@cs/contracts";
import { env } from "../env.js";

interface KeyPairEntry {
  kid: string;
  privateKey: unknown;
  publicKey: unknown;
  publicJwk: Record<string, unknown>;
}

let currentKey: KeyPairEntry | null = null;

async function getKey(): Promise<KeyPairEntry> {
  if (!currentKey) {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
    const kid = `demo-${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`;
    const publicJwk = await exportJWK(publicKey);
    currentKey = {
      kid,
      privateKey,
      publicKey,
      publicJwk: { ...publicJwk, kid, use: "sig", alg: "RS256" },
    };
  }
  return currentKey;
}

const DEMO_CREDENTIALS: Record<string, { hash: string; salt: string; tag: string }> = {
  "admin@acme.example": {
    salt: "acme-admin-salt-99",
    hash: pbkdf2Sync("AdminPassword123!", "acme-admin-salt-99", 10000, 32, "sha256").toString("hex"),
    tag: "acme-admin",
  },
  "rohan@company.com": {
    salt: "acme-admin-salt-99",
    hash: pbkdf2Sync("AdminPassword123!", "acme-admin-salt-99", 10000, 32, "sha256").toString("hex"),
    tag: "acme-admin",
  },
  "member@acme.example": {
    salt: "acme-member-salt-88",
    hash: pbkdf2Sync("MemberPassword123!", "acme-member-salt-88", 10000, 32, "sha256").toString("hex"),
    tag: "acme-member",
  },
  "vedant@company.com": {
    salt: "acme-member-salt-88",
    hash: pbkdf2Sync("MemberPassword123!", "acme-member-salt-88", 10000, 32, "sha256").toString("hex"),
    tag: "acme-member",
  },
  "sneha@company.com": {
    salt: "acme-member-salt-88",
    hash: pbkdf2Sync("MemberPassword123!", "acme-member-salt-88", 10000, 32, "sha256").toString("hex"),
    tag: "sneha",
  },
  "alex@cyberdyne.io": {
    salt: "acme-member-salt-88",
    hash: pbkdf2Sync("MemberPassword123!", "acme-member-salt-88", 10000, 32, "sha256").toString("hex"),
    tag: "alex_external",
  },
};

function verifyPassword(email: string, passwordAttempt: string): boolean {
  const cred = DEMO_CREDENTIALS[email.toLowerCase()];
  if (!cred) return false;
  const attemptHash = pbkdf2Sync(passwordAttempt, cred.salt, 10000, 32, "sha256").toString("hex");
  return timingSafeEqual(Buffer.from(attemptHash), Buffer.from(cred.hash));
}

export default async function idpRoutes(fastify: FastifyInstance) {
  // Pre-initialize key
  await getKey();

  // JWKS Endpoint
  fastify.get("/.well-known/jwks.json", async (_req, reply) => {
    const key = await getKey();
    return reply.header("Cache-Control", "public, max-age=3600").send({ keys: [key.publicJwk] });
  });

  // Token Issuance Endpoint
  fastify.route({
    method: ["GET", "POST"],
    url: "/token",
    handler: async (req, reply) => {
      const body = (req.body as any) || {};
      const query = (req.query as any) || {};
      const email = body.email || query.email;
      const password = body.password;
      const tag = body.tag || query.tag;
      const userId = body.user_id || query.user_id;

      if (email && password) {
        if (!verifyPassword(email, password)) {
          return reply.status(401).send({ error: "Invalid email or password" });
        }
      }

      const SEED_USER_MAP: Record<string, any> = {
        "rohan@company.com": {
          id: "00000001-0000-4000-a000-000000000002",
          company_id: COMPANY_ACME.id,
          name: "Rohan Deshmukh",
          email: "rohan@company.com",
          avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=rohan-deshmukh",
          permissions: [...ROLE_DEFAULTS.admin],
          department_ids: [COMPANY_ACME.department_ids[0]!.id],
          project_ids: [COMPANY_ACME.project_ids[0]!.id],
        },
        "vedant@company.com": {
          id: "00000001-0000-4000-a000-000000000003",
          company_id: COMPANY_ACME.id,
          name: "Vedant Kulkarni",
          email: "vedant@company.com",
          avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=vedant-kulkarni",
          permissions: ROLE_DEFAULTS.member.filter((p) => p !== "communication.audit.read"),
          department_ids: [COMPANY_ACME.department_ids[0]!.id],
          project_ids: [COMPANY_ACME.project_ids[0]!.id],
        },
        "sneha@company.com": {
          id: "00000001-0000-4000-a000-000000000004",
          company_id: COMPANY_ACME.id,
          name: "Sneha Patil",
          email: "sneha@company.com",
          avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=sneha-patil",
          permissions: ROLE_DEFAULTS.member.filter((p) => p !== "communication.audit.read"),
          department_ids: [COMPANY_ACME.department_ids[0]!.id],
          project_ids: [COMPANY_ACME.project_ids[0]!.id],
        },
        "alex@cyberdyne.io": {
          id: "00000002-0000-4000-b000-000000000006",
          company_id: COMPANY_GLOBEX.id,
          name: "Alex Vance",
          email: "alex@cyberdyne.io",
          avatar_url: "https://api.dicebear.com/9.x/avataaars/svg?seed=alex-vance",
          permissions: ROLE_DEFAULTS.member.filter((p) => p !== "communication.audit.read"),
          department_ids: [COMPANY_GLOBEX.department_ids[0]!.id],
          project_ids: [COMPANY_GLOBEX.project_ids[0]!.id],
        },
      };

      let user = (email && SEED_USER_MAP[email.toLowerCase()]) || ALL_USERS.find(
        (u) =>
          (userId && u.id === userId) ||
          (tag && u.tag === tag) ||
          (email && u.email.toLowerCase() === email.toLowerCase())
      );

      if (!user) {
        user = ALL_USERS.find((u) => u.tag === "acme-admin") || ALL_USERS[0];
      }

      const key = await getKey();
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 3600; // 1 hour
      const jti = randomUUID();

      const claims = {
        sub: user.id,
        company_id: user.company_id,
        permissions: user.permissions,
        name: user.name,
        avatar_url: user.avatar_url,
        department_ids: user.department_ids,
        project_ids: user.project_ids,
        iss: env.JWT_ISSUER,
        aud: env.JWT_AUDIENCE,
        iat: now,
        exp,
        jti,
      };

      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: key.kid, typ: "JWT" })
        .sign(key.privateKey as Parameters<typeof SignJWT.prototype.sign>[0]);

      return reply.send({
        access_token: token,
        token_type: "Bearer",
        expires_in: 3600,
        expires_at: new Date(exp * 1000).toISOString(),
        claims,
      });
    },
  });

  // Available Users Endpoint
  fastify.get("/idp/users", async (_req, reply) => {
    return reply.send({
      users: ALL_USERS.map((u) => ({
        id: u.id,
        tag: u.tag,
        name: u.name,
        email: u.email,
        company_id: u.company_id,
        role: u.role,
        permissions: u.permissions,
      })),
    });
  });
}

