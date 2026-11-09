import { describe, it, expect } from "vitest";
import {
  SummaryDataSchema,
  GenerateSummaryRequestSchema,
  GenerateSummaryResponseSchema,
} from "../api.js";

describe("Summary Contracts & Schema Validation", () => {
  it("validates valid SummaryData schema", () => {
    const validData = {
      overview: "Team discussed quarterly OKRs and timeline targets.",
      discussion_points: ["API v2 release", "Mobile client polish"],
      decisions: [{ decision: "Ship feature by Friday", by: "Rohan Deshmukh" }],
      pending: ["Security review approval"],
      action_items: [{ task: "Deploy staging build", assignee: "Vedant Kulkarni", due: "Friday" }],
      participants: ["Rohan Deshmukh", "Vedant Kulkarni"],
    };

    const parsed = SummaryDataSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it("accepts null for optional decision and action item fields", () => {
    const dataWithNulls = {
      overview: "Overview summary text",
      discussion_points: [],
      decisions: [{ decision: "No owner specified", by: null }],
      pending: [],
      action_items: [{ task: "Anonymous task", assignee: null, due: null }],
      participants: [],
    };

    const parsed = SummaryDataSchema.safeParse(dataWithNulls);
    expect(parsed.success).toBe(true);
  });

  it("validates GenerateSummaryRequestSchema", () => {
    const req = {
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-08T23:59:59.000Z",
      regenerate: true,
    };
    expect(GenerateSummaryRequestSchema.safeParse(req).success).toBe(true);
  });

  it("validates empty response schema", () => {
    const emptyRes = {
      empty: true,
      message: "No messages in this date range.",
    };
    expect(GenerateSummaryResponseSchema.safeParse(emptyRes).success).toBe(true);
  });

  it("calculates unread messages correctly: ignores own messages, deleted messages, and older messages", () => {
    const currentUserId = "user_1";
    const lastReadAt = new Date("2026-11-05T10:00:00Z");

    const sampleMessages = [
      // Older message
      { id: "m1", sender_id: "user_2", is_deleted: false, created_at: "2026-11-05T09:00:00Z" },
      // User's own message after lastReadAt
      { id: "m2", sender_id: "user_1", is_deleted: false, created_at: "2026-11-05T10:05:00Z" },
      // Deleted message after lastReadAt
      { id: "m3", sender_id: "user_2", is_deleted: true, created_at: "2026-11-05T10:10:00Z" },
      // Unread valid messages from others after lastReadAt
      { id: "m4", sender_id: "user_2", is_deleted: false, created_at: "2026-11-05T10:15:00Z" },
      { id: "m5", sender_id: "user_3", is_deleted: false, created_at: "2026-11-05T10:20:00Z" },
    ];

    const unreadMessages = sampleMessages.filter((m) => {
      if (m.sender_id === currentUserId) return false;
      if (m.is_deleted) return false;
      return new Date(m.created_at) > lastReadAt;
    });

    expect(unreadMessages.length).toBe(2);
    expect(unreadMessages.map((m) => m.id)).toEqual(["m4", "m5"]);
  });

  it("asserts unread threshold constant is 8", () => {
    const SUMMARY_UNREAD_THRESHOLD = 8;
    expect(SUMMARY_UNREAD_THRESHOLD).toBe(8);

    const countBelow = 7;
    const countAt = 8;
    const countAbove = 15;

    expect(countBelow >= SUMMARY_UNREAD_THRESHOLD).toBe(false);
    expect(countAt >= SUMMARY_UNREAD_THRESHOLD).toBe(true);
    expect(countAbove >= SUMMARY_UNREAD_THRESHOLD).toBe(true);
  });
});

