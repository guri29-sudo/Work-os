import { describe, it, expect, beforeEach } from "vitest";
import {
  validateAndNormalizeRange,
  computeMessagesHash,
  buildCompactTranscript,
  generateLocalFallbackSummary,
  checkSummaryRateLimit,
  resetSummaryRateLimits,
  MAX_SUMMARY_RANGE_DAYS,
  SUMMARY_RATE_LIMIT_MAX,
  type MessageRow,
} from "../../services/summary.js";

describe("Summary Service Unit Tests", () => {
  beforeEach(() => {
    resetSummaryRateLimits();
  });

  describe("validateAndNormalizeRange", () => {
    it("validates a correct 7-day range", () => {
      const from = "2026-11-01T00:00:00.000Z";
      const to = "2026-11-08T23:59:59.000Z";
      const result = validateAndNormalizeRange(from, to);
      expect(result.valid).toBe(true);
      expect(result.fromUtc).toBeDefined();
      expect(result.toUtc).toBeDefined();
      expect(result.fromUtc!.toISOString()).toContain("T00:00:00.000Z");
      expect(result.toUtc!.toISOString()).toContain("T23:59:59.999Z");
    });

    it("rejects From date after To date", () => {
      const from = "2026-11-10T00:00:00.000Z";
      const to = "2026-11-05T00:00:00.000Z";
      const result = validateAndNormalizeRange(from, to);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("From date cannot be after To date");
    });

    it("rejects range exceeding 90 days", () => {
      const from = "2026-06-01T00:00:00.000Z";
      const to = "2026-10-01T00:00:00.000Z"; // ~122 days
      const result = validateAndNormalizeRange(from, to);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`cannot exceed ${MAX_SUMMARY_RANGE_DAYS} days`);
    });

    it("rejects invalid date strings", () => {
      const result = validateAndNormalizeRange("not-a-date", "2026-11-08");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid date format");
    });
  });

  describe("computeMessagesHash", () => {
    const msg1: MessageRow = {
      id: "m1",
      author_id: "u1",
      author_name: "Alice",
      body: "Hello team",
      created_at: new Date("2026-11-05T10:00:00Z"),
      edited_at: null,
      deleted_at: null,
      mention_ids: [],
      attachment_ids: [],
    };

    const msg2: MessageRow = {
      id: "m2",
      author_id: "u2",
      author_name: "Bob",
      body: "We decided to launch on Friday",
      created_at: new Date("2026-11-05T10:05:00Z"),
      edited_at: null,
      deleted_at: null,
      mention_ids: [],
      attachment_ids: [],
    };

    it("computes identical hash for identical message list", () => {
      const hash1 = computeMessagesHash([msg1, msg2]);
      const hash2 = computeMessagesHash([msg1, msg2]);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBe(64);
    });

    it("changes hash when a message is edited", () => {
      const initialHash = computeMessagesHash([msg1, msg2]);
      const editedMsg2: MessageRow = {
        ...msg2,
        edited_at: new Date("2026-11-05T10:10:00Z"),
      };
      const newHash = computeMessagesHash([msg1, editedMsg2]);
      expect(newHash).not.toBe(initialHash);
    });

    it("changes hash when message count changes", () => {
      const hash1 = computeMessagesHash([msg1]);
      const hash2 = computeMessagesHash([msg1, msg2]);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("buildCompactTranscript", () => {
    it("groups messages by day and removes GIF noise", () => {
      const rows: MessageRow[] = [
        {
          id: "m1",
          author_id: "u1",
          author_name: "Rohan Deshmukh",
          body: "Let's review the PR https://media.giphy.com/media/xyz.gif",
          created_at: new Date("2026-11-05T14:30:00Z"),
          edited_at: null,
          deleted_at: null,
          mention_ids: [],
          attachment_ids: [],
        },
      ];
      const transcript = buildCompactTranscript(rows);
      expect(transcript).toContain("--- Date: 2026-11-05 ---");
      expect(transcript).toContain("[14:30] Rohan Deshmukh: Let's review the PR [GIF]");
    });
  });

  describe("generateLocalFallbackSummary", () => {
    it("extracts participants, decisions, and action items from transcript", () => {
      const transcript = `--- Date: 2026-11-05 ---
[10:00] Rohan Deshmukh: We decided to deploy the new auth flow today.
[10:02] Vedant Kulkarni: Sounds good. I will update the migration scripts.
[10:05] Sneha Rao: Is the database backup verified?`;

      const summary = generateLocalFallbackSummary(transcript);
      expect(summary.participants).toContain("Rohan Deshmukh");
      expect(summary.participants).toContain("Vedant Kulkarni");
      expect(summary.participants).toContain("Sneha Rao");

      expect(summary.decisions.length).toBeGreaterThan(0);
      expect(summary.decisions[0].decision).toContain("decided to deploy");
      expect(summary.decisions[0].by).toBe("Rohan Deshmukh");

      expect(summary.action_items.length).toBeGreaterThan(0);
      expect(summary.action_items[0].task).toContain("will update the migration");
      expect(summary.action_items[0].assignee).toBe("Vedant Kulkarni");

      expect(summary.pending.length).toBeGreaterThan(0);
      expect(summary.pending[0]).toContain("database backup verified?");
      expect(summary.overview).toContain("Rohan Deshmukh");
    });
  });

  describe("checkSummaryRateLimit", () => {
    it("allows up to 10 calls per hour and blocks the 11th", () => {
      const userId = "usr_rate_test";
      for (let i = 0; i < SUMMARY_RATE_LIMIT_MAX; i++) {
        const check = checkSummaryRateLimit(userId);
        expect(check.allowed).toBe(true);
        expect(check.remaining).toBe(SUMMARY_RATE_LIMIT_MAX - (i + 1));
      }

      const blockedCheck = checkSummaryRateLimit(userId);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);
      expect(blockedCheck.resetInMs).toBeGreaterThan(0);
    });
  });
});

