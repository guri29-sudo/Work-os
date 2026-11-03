import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "../pagination.js";

describe("cursor encoding/decoding", () => {
  it("round-trips a cursor payload", () => {
    const original = { seq: 42, id: "550e8400-e29b-41d4-a716-446655440000" };
    const encoded = encodeCursor(original);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(original);
  });

  it("throws on tampered cursor", () => {
    expect(() => decodeCursor("this-is-not-valid-base64!!!")).toThrow();
  });

  it("throws on cursor with wrong shape", () => {
    const bad = Buffer.from(JSON.stringify({ wrong: "shape" })).toString("base64url");
    expect(() => decodeCursor(bad)).toThrow();
  });
});
