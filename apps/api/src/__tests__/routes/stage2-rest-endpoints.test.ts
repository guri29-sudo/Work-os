import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { setupTestDb, teardownTestDb, identityFor, seedUser } from "../helpers/testDb.js";
import { buildApp } from "../../server.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

const acmeOwner = () => identityFor("acme-owner");
const acmeAdmin = () => identityFor("acme-admin");
const acmeMember = () => identityFor("acme-member");
const globexMember = () => identityFor("globex-member");
const globexOwner = () => identityFor("globex-owner");

function authHeader(identity: ReturnType<typeof acmeOwner>) {
  return { "x-test-identity": JSON.stringify(identity) };
}

describe("Stage 2 REST Endpoints Suite", () => {
  beforeAll(async () => {
    await setupTestDb();
    for (const tag of [
      "acme-owner",
      "acme-admin",
      "acme-member",
      "globex-owner",
      "globex-member",
    ]) {
      await seedUser(tag);
    }
    app = await buildApp({ testing: true });
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
  });

  let testChannelId: string;
  let testMessageId: string;

  // --- Channels CRUD & Archive -----------------------------------------------

  it("POST /v1/channels: creates a new channel with audit log", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: authHeader(acmeOwner()),
      payload: {
        name: "product-launch",
        kind: "public",
        topic: "Q4 Roadmap",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe("product-launch");
    expect(body.data.company_id).toBe(acmeOwner().companyId);
    testChannelId = body.data.id;
  });

  it("GET /v1/channels: lists channels for tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((ch: { id: string }) => ch.id === testChannelId)).toBe(true);
  });

  it("GET /v1/channels/:id: gets channel by ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/channels/${testChannelId}`,
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(testChannelId);
  });

  it("PATCH /v1/channels/:id: updates channel name and topic", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${testChannelId}`,
      headers: authHeader(acmeOwner()),
      payload: {
        name: "product-launch-v2",
        topic: "Updated topic",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("product-launch-v2");
    expect(res.json().data.topic).toBe("Updated topic");
  });

  it("POST /v1/channels/:id/archive: archives channel", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/channels/${testChannelId}/archive`,
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.is_archived).toBe(true);
  });

  it("Tenant isolation: Globex user cannot see or modify Acme channel", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: `/v1/channels/${testChannelId}`,
      headers: authHeader(globexMember()),
    });
    expect(getRes.statusCode).toBe(404);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${testChannelId}`,
      headers: authHeader(globexOwner()),
      payload: { name: "hacked" },
    });
    expect(patchRes.statusCode).toBe(404);
  });

  // --- Memberships -----------------------------------------------------------

  it("POST /v1/conversations/:id/members: adds member to channel", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/members`,
      headers: authHeader(acmeOwner()),
      payload: {
        user_id: acmeMember().userId,
        role: "member",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.user_id).toBe(acmeMember().userId);
  });

  it("GET /v1/conversations/:id/members: lists members", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/conversations/${testChannelId}/members`,
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("PATCH /v1/conversations/:id/members/:userId: updates member role and preferences", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/conversations/${testChannelId}/members/${acmeMember().userId}`,
      headers: authHeader(acmeOwner()),
      payload: {
        role: "admin",
        is_muted: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.role).toBe("admin");
    expect(res.json().data.is_muted).toBe(true);
  });

  it("DELETE /v1/conversations/:id/members/:userId: removes member", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/conversations/${testChannelId}/members/${acmeMember().userId}`,
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.success).toBe(true);

    // Re-add acmeMember for subsequent tests
    await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/members`,
      headers: authHeader(acmeOwner()),
      payload: { user_id: acmeMember().userId, role: "member" },
    });
  });

  // --- DMs and Group DMs -----------------------------------------------------

  let dmConversationId: string;

  it("POST /v1/dms: creates a 1:1 DM", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/dms",
      headers: authHeader(acmeOwner()),
      payload: {
        user_ids: [acmeMember().userId],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.type).toBe("dm");
    expect(body.created).toBe(true);
    dmConversationId = body.data.id;
  });

  it("POST /v1/dms: idempotently returns existing 1:1 DM with created=false", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/dms",
      headers: authHeader(acmeOwner()),
      payload: {
        user_ids: [acmeMember().userId],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(dmConversationId);
    expect(body.created).toBe(false);
  });

  it("POST /v1/dms: creates a group DM", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/dms",
      headers: authHeader(acmeOwner()),
      payload: {
        user_ids: [acmeAdmin().userId, acmeMember().userId],
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.type).toBe("group_dm");
  });

  it("GET /v1/dms: lists DMs for user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/dms",
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  // --- Messages & Threads ----------------------------------------------------

  it("POST /v1/conversations/:id/messages: sends root message", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/messages`,
      headers: authHeader(acmeOwner()),
      payload: {
        client_msg_id: randomUUID(),
        body: "Root thread message",
      },
    });

    expect(res.statusCode).toBe(201);
    testMessageId = res.json().data.id;
  });

  it("POST /v1/conversations/:id/messages: sends reply with parent_id", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/messages`,
      headers: authHeader(acmeMember()),
      payload: {
        client_msg_id: randomUUID(),
        parent_id: testMessageId,
        body: "First thread reply",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.parent_id).toBe(testMessageId);
  });

  it("GET /v1/conversations/:id/messages/:messageId/thread: lists replies in thread", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/conversations/${testChannelId}/messages/${testMessageId}/thread`,
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].body).toBe("First thread reply");
  });

  it("PATCH /v1/conversations/:id/messages/:messageId: edits message body", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/conversations/${testChannelId}/messages/${testMessageId}`,
      headers: authHeader(acmeOwner()),
      payload: {
        body: "Root thread message (edited)",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.body).toBe("Root thread message (edited)");
    expect(res.json().data.edited_at).toBeTruthy();
  });

  it("DELETE /v1/conversations/:id/messages/:messageId: deletes message", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/conversations/${testChannelId}/messages/${testMessageId}`,
      headers: authHeader(acmeOwner()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.success).toBe(true);
  });

  // --- Reactions -------------------------------------------------------------

  it("POST /v1/conversations/:id/messages/:messageId/reactions: adds emoji reaction", async () => {
    // Send a fresh message for reaction testing
    const mRes = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/messages`,
      headers: authHeader(acmeOwner()),
      payload: { client_msg_id: randomUUID(), body: "React to me" },
    });
    const msgId = mRes.json().data.id;

    const rRes = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/messages/${msgId}/reactions`,
      headers: authHeader(acmeMember()),
      payload: { emoji: "rocket" },
    });
    expect(rRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: "GET",
      url: `/v1/conversations/${testChannelId}/messages/${msgId}/reactions`,
      headers: authHeader(acmeOwner()),
    });
    expect(listRes.statusCode).toBe(200);
    const reactions = listRes.json().data;
    expect(
      reactions.some(
        (r: { emoji: string; count: number }) => r.emoji === "rocket" && r.count === 1,
      ),
    ).toBe(true);

    const delRes = await app.inject({
      method: "DELETE",
      url: `/v1/conversations/${testChannelId}/messages/${msgId}/reactions/rocket`,
      headers: authHeader(acmeMember()),
    });
    expect(delRes.statusCode).toBe(200);
  });

  // --- Read State & Unread Counts --------------------------------------------

  it("POST /v1/conversations/:id/read & GET /unread: marks read and updates unread counts", async () => {
    const mRes = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/messages`,
      headers: authHeader(acmeOwner()),
      payload: { client_msg_id: randomUUID(), body: "Unread message check" },
    });
    const unreadMsgId = mRes.json().data.id;

    // Check acmeMember's unread count
    const unreadBefore = await app.inject({
      method: "GET",
      url: `/v1/conversations/${testChannelId}/unread`,
      headers: authHeader(acmeMember()),
    });
    expect(unreadBefore.statusCode).toBe(200);
    expect(unreadBefore.json().data.unread_count).toBeGreaterThanOrEqual(1);

    // Mark as read
    const readRes = await app.inject({
      method: "POST",
      url: `/v1/conversations/${testChannelId}/read`,
      headers: authHeader(acmeMember()),
      payload: { last_read_message_id: unreadMsgId },
    });
    expect(readRes.statusCode).toBe(200);

    // Verify unread count is now 0
    const unreadAfter = await app.inject({
      method: "GET",
      url: `/v1/conversations/${testChannelId}/unread`,
      headers: authHeader(acmeMember()),
    });
    expect(unreadAfter.statusCode).toBe(200);
    expect(unreadAfter.json().data.unread_count).toBe(0);
  });

  // --- Drafts ----------------------------------------------------------------

  it("PUT /v1/conversations/:id/draft: saves draft and GET/DELETE retrieves and deletes it", async () => {
    const putRes = await app.inject({
      method: "PUT",
      url: `/v1/conversations/${testChannelId}/draft`,
      headers: authHeader(acmeMember()),
      payload: { body: "Work in progress draft text..." },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().data.body).toBe("Work in progress draft text...");

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/conversations/${testChannelId}/draft`,
      headers: authHeader(acmeMember()),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.body).toBe("Work in progress draft text...");

    const delRes = await app.inject({
      method: "DELETE",
      url: `/v1/conversations/${testChannelId}/draft`,
      headers: authHeader(acmeMember()),
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().data.success).toBe(true);
  });
});
