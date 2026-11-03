/**
 * Tenant Isolation Tests
 *
 * These tests verify that company boundaries are NEVER crossed:
 *  - Acme users cannot see Globex channels, messages, or conversations
 *  - Globex users cannot see Acme data even with guessed UUIDs
 *  - Cross-company auth tokens are rejected
 *  - RLS enforces isolation even if code has a bug
 *
 * Extended as new endpoints are added (this suite grows over stages).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { conversationsRepo } from "../../repositories/conversations.js";
import { messagesRepo } from "../../repositories/messages.js";
import { setupTestDb, teardownTestDb, identityFor, seedUser } from "../helpers/testDb.js";
import { randomUUID } from "node:crypto";

// Fixture identities
const acmeOwner = () => identityFor("acme-owner");
const acmeMember = () => identityFor("acme-member");
const globexOwner = () => identityFor("globex-owner");
const globexMember = () => identityFor("globex-member");

let acmeChannelId: string;
let globexChannelId: string;

describe("Tenant Isolation", () => {
  beforeAll(async () => {
    await setupTestDb();
    // Seed all users needed
    for (const tag of ["acme-owner", "acme-member", "globex-owner", "globex-member"]) {
      await seedUser(tag);
    }
    // Create one channel per company
    const acmeCh = await conversationsRepo.createChannel(acmeOwner(), {
      name: "acme-general",
      kind: "public",
    });
    acmeChannelId = acmeCh.id;

    const globexCh = await conversationsRepo.createChannel(globexOwner(), {
      name: "globex-general",
      kind: "public",
    });
    globexChannelId = globexCh.id;
  });

  afterAll(teardownTestDb);

  // -- Channel isolation ------------------------------------------------------

  it("Acme owner cannot see Globex channel by ID", async () => {
    const result = await conversationsRepo.getById(acmeOwner(), globexChannelId);
    expect(result).toBeNull();
  });

  it("Globex owner cannot see Acme channel by ID", async () => {
    const result = await conversationsRepo.getById(globexOwner(), acmeChannelId);
    expect(result).toBeNull();
  });

  it("Acme user's channel list contains only Acme channels", async () => {
    const rows = await conversationsRepo.listForUser(acmeMember(), {
      limit: 50,
    });
    for (const row of rows) {
      expect(row.company_id).toBe(acmeMember().companyId);
    }
  });

  it("Globex user's channel list contains only Globex channels", async () => {
    const rows = await conversationsRepo.listForUser(globexMember(), {
      limit: 50,
    });
    for (const row of rows) {
      expect(row.company_id).toBe(globexMember().companyId);
    }
  });

  // -- Membership isolation ---------------------------------------------------

  it("Acme owner is not a member of Globex channel", async () => {
    const result = await conversationsRepo.isMember(acmeOwner(), globexChannelId);
    expect(result).toBe(false);
  });

  it("Globex owner is not a member of Acme channel", async () => {
    const result = await conversationsRepo.isMember(globexOwner(), acmeChannelId);
    expect(result).toBe(false);
  });

  // -- Message isolation ------------------------------------------------------

  it("Acme message is invisible to Globex user by ID", async () => {
    // Send a message as Acme owner
    const { message: acmeMsg } = await messagesRepo.send(acmeOwner(), {
      conversationId: acmeChannelId,
      clientMsgId: randomUUID(),
      body: "Secret acme message",
    });

    // Globex owner tries to fetch by message ID
    const result = await messagesRepo.getById(globexOwner(), acmeMsg.id);
    expect(result).toBeNull();
  });

  it("Cross-company message list is empty even with correct conversation ID", async () => {
    const rows = await messagesRepo.list(globexOwner(), {
      conversationId: acmeChannelId,
      limit: 50,
      direction: "before",
    });
    // RLS + company_id filter means Globex user sees nothing in Acme conversation
    expect(rows.length).toBe(0);
  });

  // -- UUID guessing attack ---------------------------------------------------

  it("Random UUID lookup returns null (not found, not leaked)", async () => {
    const fakeId = randomUUID();
    const result = await conversationsRepo.getById(acmeOwner(), fakeId);
    expect(result).toBeNull();
  });

  // -- RLS enforcement verification (as restricted non-owner app_user) ----------

  it("proves the running API connects as app_user (not superuser, not BYPASSRLS)", async () => {
    const { verifyAppUserRole } = await import("../../db/verifyRole.js");
    const role = await verifyAppUserRole();
    expect(role.current_user).toBe("app_user");
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
  });

  it("RLS: raw query as app_user without app.company_id returns 0 rows", async () => {
    const { getAppUserSql } = await import("../helpers/testDb.js");
    const appSql = getAppUserSql();
    try {
      const rows = await appSql`SELECT * FROM conversations`;
      expect(rows.length).toBe(0);
    } finally {
      await appSql.end();
    }
  });

  it("RLS: raw query as app_user with Acme company_id sees Acme rows, zero Globex rows", async () => {
    const { getAppUserSql } = await import("../helpers/testDb.js");
    const appSql = getAppUserSql();
    try {
      const acmeCid = acmeOwner().companyId;
      const globexCid = globexOwner().companyId;
      await appSql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL app.company_id = '${acmeCid}'`);
        const rows = await tx`SELECT * FROM conversations`;
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.company_id).toBe(acmeCid);
          expect(row.company_id).not.toBe(globexCid);
        }
        // Direct attempt to select Globex channel while in Acme context returns 0 rows
        const target = await tx`SELECT * FROM conversations WHERE id = ${globexChannelId}`;
        expect(target.length).toBe(0);
      });
    } finally {
      await appSql.end();
    }
  });

  it("RLS: raw query as app_user with Globex company_id cannot see Acme rows", async () => {
    const { getAppUserSql } = await import("../helpers/testDb.js");
    const appSql = getAppUserSql();
    try {
      const acmeCid = acmeOwner().companyId;
      const globexCid = globexOwner().companyId;
      await appSql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL app.company_id = '${globexCid}'`);
        const rows = await tx`SELECT * FROM conversations`;
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.company_id).toBe(globexCid);
          expect(row.company_id).not.toBe(acmeCid);
        }
        // Direct attempt to select Acme channel while in Globex context returns 0 rows
        const target = await tx`SELECT * FROM conversations WHERE id = ${acmeChannelId}`;
        expect(target.length).toBe(0);
      });
    } finally {
      await appSql.end();
    }
  });
});
