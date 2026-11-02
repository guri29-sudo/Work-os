import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../../db/client.js";
import { verifyAppUserRole } from "../../db/verifyRole.js";

vi.mock("../../db/client.js", () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe("Database Role Enforcement (verifyAppUserRole)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when pg_roles returns no row", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as any);

    await expect(verifyAppUserRole()).rejects.toThrow(
      "Unable to query database user role from pg_roles",
    );
  });

  it("throws critical error when running as superuser (rolsuper: true)", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([
      { current_user: "postgres", rolsuper: true, rolbypassrls: false },
    ] as any);

    await expect(verifyAppUserRole()).rejects.toThrow(
      /CRITICAL SECURITY VIOLATION: Database connection is using a superuser role \(postgres\)/,
    );
  });

  it("throws critical error when role has BYPASSRLS attribute", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([
      { current_user: "app_user", rolsuper: false, rolbypassrls: true },
    ] as any);

    await expect(verifyAppUserRole()).rejects.toThrow(
      /CRITICAL SECURITY VIOLATION: Database role \(app_user\) has BYPASSRLS attribute/,
    );
  });

  it("throws critical error when role is not app_user (e.g. table owner or admin)", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([
      { current_user: "db_owner", rolsuper: false, rolbypassrls: false },
    ] as any);

    await expect(verifyAppUserRole()).rejects.toThrow(
      /CRITICAL SECURITY VIOLATION: Database connected as db_owner\. Must run as non-owner app_user\./,
    );
  });

  it("succeeds when connected as non-superuser, non-bypassrls app_user", async () => {
    const validRole = {
      current_user: "app_user",
      rolsuper: false,
      rolbypassrls: false,
    };
    vi.mocked(db.execute).mockResolvedValueOnce([validRole] as any);

    const result = await verifyAppUserRole();
    expect(result).toEqual(validRole);
  });
});
