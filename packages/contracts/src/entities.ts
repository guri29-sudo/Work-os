import { z } from "zod";

// --- Shared primitives -------------------------------------------------------

export const UuidSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();

// --- User --------------------------------------------------------------------

/**
 * User projection stored from JWT claims.
 * Never stores passwords or sensitive identity data.
 * Updated on each successful token verification.
 */
export const UserSchema = z.object({
  id: UuidSchema,
  company_id: UuidSchema,
  name: z.string().min(1).max(256),
  avatar_url: z.string().url().nullable(),
  department_ids: z.array(UuidSchema),
  project_ids: z.array(UuidSchema),
  is_active: z.boolean(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type User = z.infer<typeof UserSchema>;

// --- Conversation -------------------------------------------------------------

export const ConversationTypeSchema = z.enum(["dm", "group_dm", "channel"]);
export type ConversationType = z.infer<typeof ConversationTypeSchema>;

export const ChannelKindSchema = z.enum([
  "company",
  "department",
  "project",
  "public",
  "private",
  "announcement",
]);
export type ChannelKind = z.infer<typeof ChannelKindSchema>;

export const ConversationSchema = z.object({
  id: UuidSchema,
  company_id: UuidSchema,
  type: ConversationTypeSchema,
  /** Only set when type = 'channel' */
  kind: ChannelKindSchema.nullable(),
  name: z.string().min(1).max(100).nullable(),
  topic: z.string().max(500).nullable(),
  is_archived: z.boolean(),
  /** Only set when type = 'channel'; blocks non-announce posters */
  is_announcement_only: z.boolean(),
  /** Department ID for department channels */
  department_id: UuidSchema.nullable(),
  /** Project ID for project channels */
  project_id: UuidSchema.nullable(),
  member_count: z.number().int().nonnegative(),
  last_message_at: TimestampSchema.nullable(),
  created_by: UuidSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type Conversation = z.infer<typeof ConversationSchema>;

// --- Membership ---------------------------------------------------------------

export const MemberRoleSchema = z.enum(["owner", "admin", "member"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const NotificationPrefSchema = z.enum([
  "all",
  "mentions",
  "nothing",
]);
export type NotificationPref = z.infer<typeof NotificationPrefSchema>;

export const MembershipSchema = z.object({
  id: UuidSchema,
  conversation_id: UuidSchema,
  user_id: UuidSchema,
  company_id: UuidSchema,
  role: MemberRoleSchema,
  last_read_message_id: UuidSchema.nullable(),
  notification_pref: NotificationPrefSchema,
  is_muted: z.boolean(),
  joined_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type Membership = z.infer<typeof MembershipSchema>;

// --- Message ------------------------------------------------------------------

export const MessageSchema = z.object({
  id: UuidSchema,
  conversation_id: UuidSchema,
  company_id: UuidSchema,
  author_id: UuidSchema,
  /** Client-generated idempotency key (UUID) */
  client_msg_id: UuidSchema,
  /** Monotonically increasing per conversation for keyset pagination */
  seq: z.number().int().positive(),
  /** Markdown-safe body; links are allow-listed */
  body: z.string().max(8000),
  /** Thread parent – null for top-level messages */
  parent_id: UuidSchema.nullable(),
  /** Count of direct thread replies */
  reply_count: z.number().int().nonnegative(),
  edited_at: TimestampSchema.nullable(),
  deleted_at: TimestampSchema.nullable(),
  deleted_by: UuidSchema.nullable(),
  created_at: TimestampSchema,
  /** Resolved author info (denormalized for display) */
  author: UserSchema.pick({ id: true, name: true, avatar_url: true }).optional(),
  /** Attachment IDs associated with this message */
  attachment_ids: z.array(UuidSchema),
  /** Object references embedded in this message */
  object_reference_ids: z.array(UuidSchema),
  /** @mention user IDs */
  mention_ids: z.array(UuidSchema),
});

export type Message = z.infer<typeof MessageSchema>;

// --- Reaction -----------------------------------------------------------------

export const ReactionSchema = z.object({
  id: UuidSchema,
  message_id: UuidSchema,
  conversation_id: UuidSchema,
  company_id: UuidSchema,
  user_id: UuidSchema,
  emoji: z.string().min(1).max(64),
  created_at: TimestampSchema,
});

export type Reaction = z.infer<typeof ReactionSchema>;

/** Aggregated reaction summary for display */
export const ReactionSummarySchema = z.object({
  emoji: z.string(),
  count: z.number().int().positive(),
  /** IDs of users who reacted – capped at 50 for display */
  user_ids: z.array(UuidSchema),
  /** Whether the requesting user has reacted with this emoji */
  reacted_by_me: z.boolean(),
});

export type ReactionSummary = z.infer<typeof ReactionSummarySchema>;

// --- Attachment ---------------------------------------------------------------

export const AttachmentScanStatusSchema = z.enum([
  "pending",
  "clean",
  "infected",
  "error",
]);
export type AttachmentScanStatus = z.infer<typeof AttachmentScanStatusSchema>;

export const AttachmentSchema = z.object({
  id: UuidSchema,
  company_id: UuidSchema,
  message_id: UuidSchema.nullable(),
  uploader_id: UuidSchema,
  filename: z.string().max(255),
  mime_type: z.string().max(127),
  size_bytes: z.number().int().nonnegative(),
  /** SHA-256 checksum for integrity verification */
  checksum_sha256: z.string().length(64),
  scan_status: AttachmentScanStatusSchema,
  /** Not exposed to clients; internal storage key */
  storage_key: z.string().optional(),
  created_at: TimestampSchema,
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/** Attachment with a short-lived signed download URL */
export const AttachmentWithUrlSchema = AttachmentSchema.extend({
  download_url: z.string().url(),
  url_expires_at: TimestampSchema,
}).omit({ storage_key: true });

export type AttachmentWithUrl = z.infer<typeof AttachmentWithUrlSchema>;

// --- Object Reference ---------------------------------------------------------

export const ObjectReferenceSchema = z.object({
  id: UuidSchema,
  company_id: UuidSchema,
  message_id: UuidSchema,
  object_type: z.string().min(1).max(64),
  object_id: z.string().min(1).max(255),
  display_title: z.string().min(1).max(255),
  display_subtitle: z.string().max(255).nullable(),
  created_at: TimestampSchema,
});

export type ObjectReference = z.infer<typeof ObjectReferenceSchema>;

// --- Draft --------------------------------------------------------------------

export const DraftSchema = z.object({
  id: UuidSchema,
  conversation_id: UuidSchema,
  user_id: UuidSchema,
  company_id: UuidSchema,
  body: z.string().max(8000),
  updated_at: TimestampSchema,
});

export type Draft = z.infer<typeof DraftSchema>;

// --- Notification -------------------------------------------------------------

export const NotificationKindSchema = z.enum([
  "mention",
  "reply",
  "channel_message",
  "dm",
  "reaction",
  "system",
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  company_id: UuidSchema,
  kind: NotificationKindSchema,
  conversation_id: UuidSchema,
  message_id: UuidSchema.nullable(),
  actor_id: UuidSchema.nullable(),
  is_read: z.boolean(),
  created_at: TimestampSchema,
});

export type Notification = z.infer<typeof NotificationSchema>;

// --- Audit Log ----------------------------------------------------------------

export const AuditActionSchema = z.enum([
  "channel.created",
  "channel.updated",
  "channel.archived",
  "channel.unarchived",
  "member.added",
  "member.removed",
  "member.role_changed",
  "message.moderated",
  "message.restored",
  "attachment.deleted",
  "break_glass.accessed",
  "webhook.created",
  "webhook.deleted",
  "webhook.updated",
  "audit_log.read",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditLogSchema = z.object({
  id: UuidSchema,
  company_id: UuidSchema,
  actor_id: UuidSchema,
  action: AuditActionSchema,
  resource_type: z.string(),
  resource_id: z.string(),
  metadata: z.record(z.unknown()),
  ip_address: z.string().ip().nullable(),
  user_agent: z.string().max(512).nullable(),
  created_at: TimestampSchema,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// --- Webhook ------------------------------------------------------------------

export const WebhookEventTypeSchema = z.enum([
  "message.created",
  "message.updated",
  "message.deleted",
  "mention.created",
  "channel.created",
  "channel.archived",
  "member.added",
  "member.removed",
  "moderation.action",
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

export const WebhookEndpointSchema = z.object({
  id: UuidSchema,
  company_id: UuidSchema,
  url: z.string().url(),
  description: z.string().max(500).nullable(),
  events: z.array(WebhookEventTypeSchema),
  is_active: z.boolean(),
  created_by: UuidSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;
