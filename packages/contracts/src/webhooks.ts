/**
 * Webhook payload schemas.
 * Payloads contain minimal data (IDs + display info), never raw attachment
 * bytes or DM body content (unless explicitly configured per endpoint).
 *
 * Signature verification:
 *   HMAC-SHA256 over `${X-Timestamp}.${rawBody}`
 *   Header: X-Signature: sha256=<hex>
 *   Reject if |now - X-Timestamp| > 300 seconds (replay resistance)
 */
import { z } from "zod";
import { UuidSchema, TimestampSchema, WebhookEventTypeSchema } from "./entities.js";

export const WebhookHeadersSchema = z.object({
  "x-signature": z.string().regex(/^sha256=[a-f0-9]{64}$/),
  "x-timestamp": z.string(),
  "x-event-id": z.string().uuid(),
  "x-event-type": WebhookEventTypeSchema,
  "x-delivery-id": z.string().uuid(),
});

export const WebhookEnvelopeSchema = z.object({
  /** Unique delivery ID for deduplication */
  delivery_id: UuidSchema,
  /** Unique event ID – same event may be redelivered with the same event_id */
  event_id: UuidSchema,
  event_type: WebhookEventTypeSchema,
  company_id: UuidSchema,
  /** ISO timestamp when the event occurred */
  occurred_at: TimestampSchema,
  /** Version of the webhook payload schema */
  schema_version: z.literal(1),
  data: z.record(z.unknown()),
});

export type WebhookEnvelope = z.infer<typeof WebhookEnvelopeSchema>;

// --- Specific webhook payloads ------------------------------------------------

export const MessageCreatedWebhookDataSchema = z.object({
  message_id: UuidSchema,
  conversation_id: UuidSchema,
  author_id: UuidSchema,
  author_name: z.string(),
  /** Truncated body preview (max 200 chars). NOT sent for private DMs by default. */
  body_preview: z.string().max(200).optional(),
  has_attachments: z.boolean(),
  mention_ids: z.array(UuidSchema),
  parent_id: UuidSchema.nullable(),
});

export const MessageUpdatedWebhookDataSchema = z.object({
  message_id: UuidSchema,
  conversation_id: UuidSchema,
  author_id: UuidSchema,
  edited_at: TimestampSchema,
});

export const MessageDeletedWebhookDataSchema = z.object({
  message_id: UuidSchema,
  conversation_id: UuidSchema,
  deleted_by: UuidSchema,
  deleted_at: TimestampSchema,
});

export const MentionCreatedWebhookDataSchema = z.object({
  message_id: UuidSchema,
  conversation_id: UuidSchema,
  author_id: UuidSchema,
  mentioned_user_id: UuidSchema,
});

export const ChannelCreatedWebhookDataSchema = z.object({
  conversation_id: UuidSchema,
  name: z.string(),
  kind: z.string(),
  created_by: UuidSchema,
});

export const ChannelArchivedWebhookDataSchema = z.object({
  conversation_id: UuidSchema,
  archived_by: UuidSchema,
  archived_at: TimestampSchema,
});

export const MemberAddedWebhookDataSchema = z.object({
  conversation_id: UuidSchema,
  user_id: UuidSchema,
  added_by: UuidSchema,
  role: z.string(),
});

export const MemberRemovedWebhookDataSchema = z.object({
  conversation_id: UuidSchema,
  user_id: UuidSchema,
  removed_by: UuidSchema,
});

export const ModerationActionWebhookDataSchema = z.object({
  message_id: UuidSchema,
  conversation_id: UuidSchema,
  moderator_id: UuidSchema,
  action: z.enum(["deleted", "restored"]),
  reason: z.string().optional(),
});
