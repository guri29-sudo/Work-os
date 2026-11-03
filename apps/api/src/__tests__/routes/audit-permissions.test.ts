import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb, identityFor, seedUser } from "../helpers/testDb.js";
import { buildApp } from "../../server.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

describe("Audit log permission gates", () => {
  beforeAll(async () => {
    await setupTestDb();
    for (const tag of ["acme-admin", "acme-member"]) await seedUser(tag);
    app = await buildApp({ testing: true });
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
  });

  it("GET /v1/audit-log: Member (no audit.read) gets 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/audit-log",
      headers: { "x-test-identity": JSON.stringify(identityFor("acme-member")) },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /v1/audit-log: Admin (audit.read) gets 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/audit-log",
      headers: { "x-test-identity": JSON.stringify(identityFor("acme-admin")) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

