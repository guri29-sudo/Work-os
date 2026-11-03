import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_VALUES,
  ROLE_DEFAULTS,
} from "../permissions.js";

describe("permissions", () => {
  it("all permission values are namespaced under communication.*", () => {
    for (const v of PERMISSION_VALUES) {
      expect(v).toMatch(/^communication\./);
    }
  });

  it("PERMISSION_VALUES covers all PERMISSIONS entries", () => {
    const permSet = new Set(PERMISSION_VALUES);
    for (const p of Object.values(PERMISSIONS)) {
      expect(permSet.has(p)).toBe(true);
    }
  });

  it("owner role has all permissions", () => {
    const ownerPerms = new Set(ROLE_DEFAULTS.owner);
    for (const p of Object.values(PERMISSIONS)) {
      expect(ownerPerms.has(p)).toBe(true);
    }
  });

  it("guest role has a strict subset of member permissions", () => {
    const memberPerms = new Set(ROLE_DEFAULTS.member);
    for (const p of ROLE_DEFAULTS.guest) {
      expect(memberPerms.has(p)).toBe(true);
    }
  });
});
