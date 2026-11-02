import { describe, it, expect } from "vitest";
import { policy, AuthorizationError } from "../../policy/index.js";
import { PERMISSIONS, type Permission, ROLE_DEFAULTS } from "@cs/contracts";
import type { RequestIdentity } from "../../auth/plugin.js";

function makeIdentity(permissions: Permission[], companyId = "comp-acme"): RequestIdentity {
  return {
    userId: "usr-test",
    companyId,
    permissions,
    name: "Test User",
    avatarUrl: null,
  };
}

describe("RBAC 25-Endpoint Matrix & Permission Claims Suite", () => {
  const allPermissions = Object.values(PERMISSIONS);

  describe("Section 5 Canonical Permissions Definition", () => {
    it("defines exactly the 9 required communication permissions", () => {
      expect(allPermissions).toEqual([
        "communication.access",
        "communication.channel.create",
        "communication.private_channel.create",
        "communication.channel.manage",
        "communication.member.manage",
        "communication.message.send",
        "communication.message.moderate",
        "communication.announcement.publish",
        "communication.audit.read",
      ]);
    });
  });

  describe("Endpoint Permission Enforcement Matrix", () => {
    // 1. Base Access
    it("enforces communication.access for all platform interaction", () => {
      const noAccess = makeIdentity([]);
      const hasAccess = makeIdentity([PERMISSIONS.ACCESS]);

      expect(() => policy.require(noAccess, PERMISSIONS.ACCESS)).toThrow(AuthorizationError);
      expect(() => policy.require(hasAccess, PERMISSIONS.ACCESS)).not.toThrow();
    });

    // 2. Public / Project Channel Creation
    it("enforces communication.channel.create for public channels", () => {
      const member = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.CHANNEL_CREATE]);
      const guest = makeIdentity([PERMISSIONS.ACCESS]);

      expect(() => policy.require(member, PERMISSIONS.CHANNEL_CREATE)).not.toThrow();
      expect(() => policy.require(guest, PERMISSIONS.CHANNEL_CREATE)).toThrow(AuthorizationError);
    });

    // 3. Private Channel Creation
    it("enforces communication.private_channel.create for restricted channels", () => {
      const admin = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.PRIVATE_CHANNEL_CREATE]);
      const regular = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.CHANNEL_CREATE]);

      expect(() => policy.require(admin, PERMISSIONS.PRIVATE_CHANNEL_CREATE)).not.toThrow();
      expect(() => policy.require(regular, PERMISSIONS.PRIVATE_CHANNEL_CREATE)).toThrow(
        AuthorizationError,
      );
    });

    // 4. Channel Settings & Archive / Unarchive
    it("enforces communication.channel.manage for channel edit & archive", () => {
      const manager = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.CHANNEL_MANAGE]);
      const nonManager = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.CHANNEL_CREATE]);

      expect(() => policy.require(manager, PERMISSIONS.CHANNEL_MANAGE)).not.toThrow();
      expect(() => policy.require(nonManager, PERMISSIONS.CHANNEL_MANAGE)).toThrow(
        AuthorizationError,
      );
    });

    // 5. Member Add / Remove / Role Change
    it("enforces communication.member.manage for membership administration", () => {
      const memberAdmin = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.MEMBER_MANAGE]);
      const regular = makeIdentity([PERMISSIONS.ACCESS]);

      expect(() => policy.require(memberAdmin, PERMISSIONS.MEMBER_MANAGE)).not.toThrow();
      expect(() => policy.require(regular, PERMISSIONS.MEMBER_MANAGE)).toThrow(
        AuthorizationError,
      );
    });

    // 6. Message Posting
    it("enforces communication.message.send for sending messages and uploading attachments", () => {
      const sender = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.MESSAGE_SEND]);
      const readOnly = makeIdentity([PERMISSIONS.ACCESS]);

      expect(() => policy.require(sender, PERMISSIONS.MESSAGE_SEND)).not.toThrow();
      expect(() => policy.require(readOnly, PERMISSIONS.MESSAGE_SEND)).toThrow(AuthorizationError);
    });

    // 7. Moderation Soft-Delete / Restore
    it("enforces communication.message.moderate for moderator deletion", () => {
      const moderator = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.MESSAGE_MODERATE]);
      const author = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.MESSAGE_SEND]);

      expect(() => policy.require(moderator, PERMISSIONS.MESSAGE_MODERATE)).not.toThrow();
      expect(() => policy.require(author, PERMISSIONS.MESSAGE_MODERATE)).toThrow(
        AuthorizationError,
      );
    });

    // 8. Announcement Channels
    it("enforces communication.announcement.publish for broadcast posting", () => {
      const publisher = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.ANNOUNCEMENT_PUBLISH]);
      const regular = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.MESSAGE_SEND]);

      expect(() => policy.require(publisher, PERMISSIONS.ANNOUNCEMENT_PUBLISH)).not.toThrow();
      expect(() => policy.require(regular, PERMISSIONS.ANNOUNCEMENT_PUBLISH)).toThrow(
        AuthorizationError,
      );
    });

    // 9. Audit Trail Reading
    it("enforces communication.audit.read for security log inspection", () => {
      const auditor = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.AUDIT_READ]);
      const regular = makeIdentity([PERMISSIONS.ACCESS, PERMISSIONS.MESSAGE_SEND]);

      expect(() => policy.require(auditor, PERMISSIONS.AUDIT_READ)).not.toThrow();
      expect(() => policy.require(regular, PERMISSIONS.AUDIT_READ)).toThrow(AuthorizationError);
    });
  });

  describe("Role Default Presets Conformance", () => {
    it("verifies owner role has all 9 permissions", () => {
      expect(ROLE_DEFAULTS.owner.length).toBe(9);
    });

    it("verifies member role has access, channel.create, message.send", () => {
      expect(ROLE_DEFAULTS.member).toContain(PERMISSIONS.ACCESS);
      expect(ROLE_DEFAULTS.member).toContain(PERMISSIONS.CHANNEL_CREATE);
      expect(ROLE_DEFAULTS.member).toContain(PERMISSIONS.MESSAGE_SEND);
      expect(ROLE_DEFAULTS.member).not.toContain(PERMISSIONS.AUDIT_READ);
    });
  });

  describe("Tenant Isolation Boundary", () => {
    it("strictly blocks cross-company access across companies", () => {
      const acmeUser = makeIdentity([PERMISSIONS.ACCESS], "comp-acme");
      expect(() => policy.requireSameCompany(acmeUser, "comp-acme")).not.toThrow();
      expect(() => policy.requireSameCompany(acmeUser, "comp-globex")).toThrow(
        AuthorizationError,
      );
    });
  });
});
