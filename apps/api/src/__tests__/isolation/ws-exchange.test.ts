import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupTestDb,
  teardownTestDb,
  identityFor,
  seedUser,
  getTestDb,
} from "../helpers/testDb.js";
import { conversationsRepo } from "../../repositories/conversations.js";
import { memberships } from "../../db/schema/index.js";
import { sql } from "drizzle-orm";
import { buildApp } from "../../server.js";
import type { FastifyInstance } from "fastify";

const acmeOwner = () => identityFor("acme-owner");
const acmeMember = () => identityFor("acme-member");
const globexMember = () => identityFor("globex-member");

let app: FastifyInstance;
let channelId: string;

describe("WebSocket � Stage 2 Exit Criterion", () => {
  beforeAll(async () => {
    await setupTestDb();

    for (const tag of ["acme-owner", "acme-member", "globex-member"]) {
      await seedUser(tag);
    }

    const ch = await conversationsRepo.createChannel(acmeOwner(), {
      name: "ws-test-channel",
      kind: "public",
    });
    channelId = ch.id;

    // Add acme-member to the channel using the DB inside a transaction that sets RLS context
    const db = getTestDb();
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.company_id', ${acmeMember().companyId}, true)`);
      await tx
        .insert(memberships)
        .values({
          conversation_id: channelId,
          user_id: acmeMember().userId,
          company_id: acmeMember().companyId,
          role: "member",
        })
        .onConflictDoNothing();
    });

    app = await buildApp({ testing: true });
    await app.listen({ port: 0, host: "127.0.0.1" });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await teardownTestDb();
  });

  it("REST: /health/live returns 200 (no auth)", async () => {
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3001;
    const res = await fetch(`http://127.0.0.1:${port}/health/live`);
    expect(res.status).toBe(200);
  });

  it("Idempotent send: same clientMsgId returns original message (created=false on replay)", async () => {
    const clientMsgId = randomUUID();
    const identity = acmeOwner();
    const { messagesRepo } = await import("../../repositories/messages.js");

    const r1 = await messagesRepo.send(identity, {
      conversationId: channelId,
      clientMsgId,
      body: "Hello idempotency!",
    });
    expect(r1.created).toBe(true);
    const r2 = await messagesRepo.send(identity, {
      conversationId: channelId,
      clientMsgId,
      body: "Hello idempotency!",
    });
    expect(r2.created).toBe(false);
    expect(r2.message.id).toBe(r1.message.id);
    expect(r2.message.seq).toBe(r1.message.seq);
  });

  it("Idempotent send: 10 concurrent retries yield exactly 1 message row (no duplicates)", async () => {
    const clientMsgId = randomUUID();
    const identity = acmeOwner();
    const { messagesRepo } = await import("../../repositories/messages.js");

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        messagesRepo.send(identity, {
          conversationId: channelId,
          clientMsgId,
          body: "Concurrent test",
        }),
      ),
    );

    const ids = new Set(results.map((r) => r.message.id));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.created).length).toBe(1);
    expect(results.filter((r) => !r.created).length).toBe(9);
  });

  it("Message seq is monotonically increasing per conversation", async () => {
    const identity = acmeOwner();
    const { messagesRepo } = await import("../../repositories/messages.js");

    const sends = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        messagesRepo.send(identity, {
          conversationId: channelId,
          clientMsgId: randomUUID(),
          body: `Seq test ${i}`,
        }),
      ),
    );

    const seqs = sends.map((r) => r.message.seq).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }
  });

  it("Cross-company: Globex cannot read Acme messages or list Acme conversation", async () => {
    const acme = acmeOwner();
    const globex = globexMember();
    const { messagesRepo } = await import("../../repositories/messages.js");

    const { message } = await messagesRepo.send(acme, {
      conversationId: channelId,
      clientMsgId: randomUUID(),
      body: "Top secret Acme data",
    });

    expect(await messagesRepo.getById(globex, message.id)).toBeNull();
    const rows = await messagesRepo.list(globex, {
      conversationId: channelId,
      limit: 50,
      direction: "before",
    });
    expect(rows.length).toBe(0);
  });

  it("audit_log: UPDATE throws (append-only trigger)", async () => {
    const { getTestSql } = await import("../helpers/testDb.js");
    const rawSql = getTestSql();
    await rawSql.unsafe(`SET app.company_id = '${acmeOwner().companyId}'`);
    await rawSql`
      INSERT INTO audit_log(company_id, actor_id, action, resource_type, resource_id)
      VALUES(${acmeOwner().companyId}, ${acmeOwner().userId}, 'channel.created', 'conversation', 'x-test')
    `;
    await expect(
      rawSql`UPDATE audit_log SET resource_id = 'tampered' WHERE resource_type = 'conversation'`,
    ).rejects.toThrow("append-only");
  });

  it("audit_log: DELETE throws (append-only trigger)", async () => {
    const { getTestSql } = await import("../helpers/testDb.js");
    const rawSql = getTestSql();
    await rawSql.unsafe(`SET app.company_id = '${acmeOwner().companyId}'`);
    await expect(
      rawSql`DELETE FROM audit_log WHERE resource_type = 'conversation'`,
    ).rejects.toThrow("append-only");
  });
});
