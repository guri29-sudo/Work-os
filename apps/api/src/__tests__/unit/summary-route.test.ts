import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../server.js";
import { CAROL, BOB, FRANK, COMPANY_ACME } from "@cs/test-fixtures";
import { resetSummaryRateLimits } from "../../services/summary.js";

describe("Summary API Route Tests", () => {
  beforeEach(() => {
    resetSummaryRateLimits();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const app = await buildApp({ testing: true });
    const res = await app.inject({
      method: "POST",
      url: "/v1/conversations/00000000-0000-0000-0000-000000000001/summary",
      payload: {
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-08T23:59:59.000Z",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  const carolIdentity = {
    userId: CAROL.id,
    companyId: CAROL.company_id,
    name: CAROL.name,
    avatarUrl: CAROL.avatar_url,
    permissions: CAROL.permissions,
  };

  it("rejects invalid date range (from > to) with 400", async () => {
    const app = await buildApp({ testing: true });
    const res = await app.inject({
      method: "POST",
      url: "/v1/conversations/00000000-0000-0000-0000-000000000001/summary",
      headers: {
        "x-test-identity": JSON.stringify(carolIdentity),
      },
      payload: {
        from: "2026-11-10T00:00:00.000Z",
        to: "2026-11-05T00:00:00.000Z",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe("INVALID_RANGE");
    expect(body.error?.message).toContain("From date cannot be after To date");
  });

  it("rejects range exceeding 90 days with 400", async () => {
    const app = await buildApp({ testing: true });
    const res = await app.inject({
      method: "POST",
      url: "/v1/conversations/00000000-0000-0000-0000-000000000001/summary",
      headers: {
        "x-test-identity": JSON.stringify(carolIdentity),
      },
      payload: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe("INVALID_RANGE");
    expect(body.error?.message).toContain("cannot exceed 90 days");
  });

  it("supports both /v1/... and /api/... route paths", async () => {
    const app = await buildApp({ testing: true });
    const res1 = await app.inject({
      method: "POST",
      url: "/v1/conversations/00000000-0000-0000-0000-000000000001/summary",
      headers: {
        "x-test-identity": JSON.stringify(carolIdentity),
      },
      payload: { from: "2026-11-10T00:00:00Z", to: "2026-11-05T00:00:00Z" },
    });
    expect(res1.statusCode).toBe(400);

    const res2 = await app.inject({
      method: "POST",
      url: "/api/conversations/00000000-0000-0000-0000-000000000001/summary",
      headers: {
        "x-test-identity": JSON.stringify(carolIdentity),
      },
      payload: { from: "2026-11-10T00:00:00Z", to: "2026-11-05T00:00:00Z" },
    });
    expect(res2.statusCode).toBe(400);
  });
});

