import { z } from "zod";

/**
 * Keyset (cursor-based) pagination used by ALL list endpoints.
 * Cursors are opaque base64-encoded JSON {seq, id} pairs.
 * This prevents clients from relying on implementation details.
 */
export const CursorSchema = z.string().base64().optional();

export const PaginationQuerySchema = z.object({
  /** Opaque cursor from a previous response */
  cursor: CursorSchema,
  /** Number of items to return; capped at 100 */
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
  /** "before" = older messages, "after" = newer messages */
  direction: z.enum(["before", "after"]).optional().default("before"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable(),
  endCursor: z.string().nullable(),
  /** Total count � may be expensive; only returned when explicitly requested */
  total: z.number().int().optional(),
});

export type PageInfo = z.infer<typeof PageInfoSchema>;

/** Encode a cursor from a {seq, id} pair */
export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** Decode and validate a cursor string */
export function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as unknown;
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as Record<string, unknown>).seq !== "number" ||
      typeof (decoded as Record<string, unknown>).id !== "string"
    ) {
      throw new Error("invalid shape");
    }
    return decoded as { seq: number; id: string };
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}
