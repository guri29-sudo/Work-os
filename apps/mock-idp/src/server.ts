/**
 * Mock Identity Provider HTTP server.
 *
 * Endpoints:
 *   GET  /.well-known/jwks.json   � Public keys for JWT verification
 *   GET  /token?user_id=<id>      � Issue a token for a synthetic user (dev only)
 *   GET  /token?tag=<tag>         � Issue a token by user tag
 *   POST /token                   � Same, JSON body { user_id } or { tag }
 *   GET  /users                   � List available synthetic users
 *   POST /rotate-keys             � Rotate signing keys (for testing rotation)
 *   GET  /health                  � Health check
 *
 * This server MUST NEVER be used in production.
 * It has no auth on the /token endpoint intentionally � it is a dev tool.
 */
import http from "http";
import crypto from "crypto";
import { config } from "./config.js";
import { initKeyStore, keyStore } from "./keypair.js";
import { issueToken } from "./token.js";
import { ALL_USERS, findUserById } from "@cs/test-fixtures";

// Hashed demo credentials (passwords hashed with PBKDF2; never stored in plaintext)
const DEMO_CREDENTIALS: Record<string, { hash: string; salt: string; tag: string }> = {
  "admin@acme.example": {
    salt: "acme-admin-salt-99",
    hash: crypto.pbkdf2Sync("AdminPassword123!", "acme-admin-salt-99", 10000, 32, "sha256").toString("hex"),
    tag: "acme-admin",
  },
  "rohan@company.com": {
    salt: "acme-admin-salt-99",
    hash: crypto.pbkdf2Sync("AdminPassword123!", "acme-admin-salt-99", 10000, 32, "sha256").toString("hex"),
    tag: "acme-admin",
  },
  "member@acme.example": {
    salt: "acme-member-salt-88",
    hash: crypto.pbkdf2Sync("MemberPassword123!", "acme-member-salt-88", 10000, 32, "sha256").toString("hex"),
    tag: "acme-member",
  },
  "vedant@company.com": {
    salt: "acme-member-salt-88",
    hash: crypto.pbkdf2Sync("MemberPassword123!", "acme-member-salt-88", 10000, 32, "sha256").toString("hex"),
    tag: "acme-member",
  },
};

function verifyPassword(email: string, passwordAttempt: string): boolean {
  const cred = DEMO_CREDENTIALS[email.toLowerCase()];
  if (!cred) return false;
  const attemptHash = crypto.pbkdf2Sync(passwordAttempt, cred.salt, 10000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(attemptHash), Buffer.from(cred.hash));
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    // Remind anyone who stumbles across this that it is dev-only
    "X-Cs-Mock-Idp": "true",
    "X-Cs-Warning": "dev-only-not-for-production",
  });
  res.end(payload);
}

function parseQuery(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > 4096) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as unknown) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function resolveUser(query: URLSearchParams, body: Record<string, unknown>): { user: (typeof ALL_USERS)[number] } | { error: string; status?: number } {
  const userId = (query.get("user_id") ?? body.user_id) as string | undefined;
  const tag = (query.get("tag") ?? body.tag) as string | undefined;
  const email = (query.get("email") ?? body.email) as string | undefined;
  const password = (query.get("password") ?? body.password) as string | undefined;

  if (email && password !== undefined) {
    if (!verifyPassword(email, password)) {
      return { error: "Invalid email or password", status: 401 };
    }
    const cred = DEMO_CREDENTIALS[email.toLowerCase()];
    const user = ALL_USERS.find((u) => u.tag === cred?.tag || u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { error: `User not found for email: ${email}`, status: 404 };
    return { user };
  }

  if (email) {
    const user = ALL_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) return { user };
  }

  if (userId) {
    const user = findUserById(userId);
    if (!user) return { error: `User not found: ${userId}`, status: 404 };
    return { user };
  }

  if (tag) {
    const user = ALL_USERS.find((u) => u.tag === tag);
    if (!user) return { error: `No user with tag: ${tag}`, status: 404 };
    return { user };
  }

  return { error: "Provide user_id, tag, or email/password credentials", status: 400 };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const urlObj = new URL(req.url ?? "/", `http://localhost:${config.PORT}`);
  const path = urlObj.pathname;
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  // Root dashboard (HTML or JSON)
  if (path === "/" && method === "GET") {
    const isBrowser = (req.headers.accept ?? "").includes("text/html");
    if (!isBrowser) {
      json(res, 200, {
        service: "WorkOS Mock Identity Provider",
        status: "operational",
        port: config.PORT,
        endpoints: {
          jwks: "/.well-known/jwks.json",
          token: "/token?tag=acme-owner",
          users: "/users",
          health: "/health",
        },
        mainApp: "http://localhost:5173/",
      });
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WorkOS Mock Identity Provider</title>
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
    <div class="badge"><span class="dot"></span> Operational (Port ${config.PORT})</div>
    <h1>WorkOS Mock Identity Provider</h1>
    <p>This service simulates the WorkOS Authentication & Token Issuer. It issues signed RS256 JSON Web Tokens and serves JWKS keys for local integration.</p>
    <a href="http://localhost:5173" class="btn">🚀 Open Main Application (http://localhost:5173) &rarr;</a>
    <div class="section-title">Available Mock IdP Endpoints</div>
    <ul class="list">
      <li><a href="/.well-known/jwks.json" target="_blank"><span>🔑 Public JWKS Keystore</span><span>/.well-known/jwks.json &rarr;</span></a></li>
      <li><a href="/token?tag=acme-owner" target="_blank"><span>🎟️ Issue Token: Alice Chen (Owner)</span><span>/token?tag=acme-owner &rarr;</span></a></li>
      <li><a href="/token?tag=acme-member" target="_blank"><span>🎟️ Issue Token: Carol Thompson (Member)</span><span>/token?tag=acme-member &rarr;</span></a></li>
      <li><a href="/users" target="_blank"><span>👥 List Synthetic Personas</span><span>/users &rarr;</span></a></li>
      <li><a href="/health" target="_blank"><span>💓 Health Status</span><span>/health &rarr;</span></a></li>
    </ul>
    <div class="note">Designed for WorkOS Internal Communication System development & integration testing.</div>
  </div>
</body>
</html>`;

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(html),
    });
    res.end(html);
    return;
  }

  // Health
  if (path === "/health" && method === "GET") {
    json(res, 200, {
      status: "ok",
      service: "mock-idp",
      warning: "dev-only",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // JWKS
  if (path === "/.well-known/jwks.json" && method === "GET") {
    json(res, 200, { keys: keyStore.getPublicKeys() });
    return;
  }

  // List users
  if (path === "/users" && method === "GET") {
    json(res, 200, {
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
    return;
  }

  // Issue token
  if (path === "/token" && (method === "GET" || method === "POST")) {
    const query = parseQuery(req.url ?? "/");
    let body: Record<string, unknown> = {};

    if (method === "POST") {
      try {
        const raw = await readBody(req);
        body = raw as Record<string, unknown>;
      } catch (e) {
        json(res, 400, { error: String(e) });
        return;
      }
    }

    const result = resolveUser(query, body);
    if ("error" in result) {
      json(res, 400, { error: result.error });
      return;
    }

    try {
      const issued = await issueToken(result.user);
      console.error(
        `[mock-idp] Issued token for ${result.user.name} (${result.user.tag}) exp=${issued.expires_at}`,
      );
      json(res, 200, issued);
    } catch (e) {
      console.error("[mock-idp] Token issuance failed:", e);
      json(res, 500, { error: "Token issuance failed" });
    }
    return;
  }

  // Rotate keys
  if (path === "/rotate-keys" && method === "POST") {
    const newKey = await keyStore.rotate();
    console.error(`[mock-idp] Keys rotated. New kid: ${newKey.kid}`);
    json(res, 200, {
      message: "Keys rotated",
      kid: newKey.kid,
      total_keys: keyStore.getPublicKeys().length,
    });
    return;
  }

  json(res, 404, { error: "Not found" });
}

export async function startServer(): Promise<void> {
  await initKeyStore();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error("[mock-idp] Unhandled error:", err);
      if (!res.headersSent) {
        json(res, 500, { error: "Internal server error" });
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(config.PORT, "0.0.0.0", () => {
      console.error(`[mock-idp] ??  DEV ONLY � Mock IdP running on http://0.0.0.0:${config.PORT}`);
      console.error(`[mock-idp] JWKS: http://localhost:${config.PORT}/.well-known/jwks.json`);
      console.error(`[mock-idp] Token: http://localhost:${config.PORT}/token?tag=acme-owner`);
      console.error(`[mock-idp] Users: http://localhost:${config.PORT}/users`);
      resolve();
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.error("[mock-idp] Shutting down...");
    server.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    console.error("[mock-idp] Shutting down...");
    server.close(() => process.exit(0));
  });
}
