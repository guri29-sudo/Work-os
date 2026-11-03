import { describe, it, expect } from "vitest";
import { policy, AuthorizationError } from "../../policy/index.js";
import { PERMISSIONS } from "@cs/contracts";
import type { RequestIdentity } from "../../auth/plugin.js";

const adminIdentity: RequestIdentity = {
  userId: "u-admin",
  companyId: "c-acme",
  permissions: [
    PERMISSIONS.ACCESS,
    PERMISSIONS.CHANNEL_CREATE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_MODERATE,
    PERMISSIONS.CHANNEL_MANAGE,
  ],
  name: "Admin",
  avatarUrl: null,
};

const guestIdentity: RequestIdentity = {
  userId: "u-guest",
  companyId: "c-acme",
  permissions: [PERMISSIONS.ACCESS],
  name: "Guest",
  avatarUrl: null,
};

describe("Policy", () => {
  it("require: passes when permission is present", () => {
    expect(() => {
      policy.require(adminIdentity, PERMISSIONS.CHANNEL_CREATE);
    }).not.toThrow();
  });

  it("require: throws AuthorizationError when permission is missing", () => {
    expect(() => {
      policy.require(guestIdentity, PERMISSIONS.CHANNEL_CREATE);
    }).toThrow(AuthorizationError);
  });

  it("can: returns true for held permission", () => {
    expect(policy.can(adminIdentity, PERMISSIONS.MESSAGE_MODERATE)).toBe(true);
  });

  it("can: returns false for missing permission", () => {
    expect(policy.can(guestIdentity, PERMISSIONS.MESSAGE_MODERATE)).toBe(false);
  });

  it("requireSameCompany: passes for same company", () => {
    expect(() => {
      policy.requireSameCompany(adminIdentity, "c-acme");
    }).not.toThrow();
  });

  it("requireSameCompany: throws for different company", () => {
    expect(() => {
      policy.requireSameCompany(adminIdentity, "c-globex");
    }).toThrow(AuthorizationError);
  });

  it("guest has ACCESS but not CHANNEL_CREATE", () => {
    expect(policy.can(guestIdentity, PERMISSIONS.ACCESS)).toBe(true);
    expect(policy.can(guestIdentity, PERMISSIONS.CHANNEL_CREATE)).toBe(false);
  });

  it("audit access: member without AUDIT_READ gets 403, admin gets 200/allowed", () => {
    expect(() => {
      policy.require(guestIdentity, PERMISSIONS.AUDIT_READ);
    }).toThrow(AuthorizationError);

    const adminWithAudit: RequestIdentity = {
      ...adminIdentity,
      permissions: [...adminIdentity.permissions, PERMISSIONS.AUDIT_READ],
    };
    expect(() => {
      policy.require(adminWithAudit, PERMISSIONS.AUDIT_READ);
    }).not.toThrow();
  });
});
