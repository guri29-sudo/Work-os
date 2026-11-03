import { describe, it, expect } from "vitest";
import { TokenClaimsSchema } from "../jwt.js";

const basePayload = {
  sub: "550e8400-e29b-41d4-a716-446655440000",
  company_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  permissions: ["communication.access", "communication.message.send"],
  name: "Alice Engineer",
  avatar_url: "https://example.com/alice.png",
  department_ids: [],
  project_ids: [],
  iss: "http://localhost:4001",
  aud: "communication-system",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 840,
  jti: "e97d59a0-7b44-4f2c-8c8e-123456789abc",
};

describe("TokenClaimsSchema", () => {
  it("accepts a valid token payload", () => {
    const result = TokenClaimsSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID sub", () => {
    const result = TokenClaimsSchema.safeParse({
      ...basePayload,
      sub: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects http avatar_url", () => {
    const result = TokenClaimsSchema.safeParse({
      ...basePayload,
      avatar_url: "http://insecure.example.com/img.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown permission strings", () => {
    const result = TokenClaimsSchema.safeParse({
      ...basePayload,
      permissions: ["communication.access", "communication.FAKE_PERMISSION"],
    });
    expect(result.success).toBe(false);
  });

  it("allows array audience", () => {
    const result = TokenClaimsSchema.safeParse({
      ...basePayload,
      aud: ["communication-system", "another-service"],
    });
    expect(result.success).toBe(true);
  });
});
