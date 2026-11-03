/**
 * API request/response schemas for every endpoint.
 * These are the single source of truth for the API contract.
 * Both backend (Fastify) and frontend (TanStack Query) import from here.
 */
import { z } from "zod";
import {
  ConversationSchema,
  MembershipSchema,
  MessageSchema,
  ReactionSummarySchema,
  ObjectReferenceSchema,
  NotificationSchema,
  AuditLogSchema,
  WebhookEndpointSchema,
  UuidSchema,
  ChannelKindSchema,
  MemberRoleSchema,
  NotificationPrefSchema,
  WebhookEventTypeSchema,
  UserSchema,
} from "./entities.js";
import { PageInfoSchema } from "./pagination.js";

// --- Shared response wrappers -------------------------------------------------

export function paginated<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pageInfo: PageInfoSchema,
  });
}

// --- Channels -----------------------------------------------------------------

export const CreateChannelRequestSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9_-]+$/,
      "Channel names must be lowercase alphanumeric, hyphens, or underscores",
    ),
  topic: z.string().max(500).optional(),
  kind: ChannelKindSchema,
  department_id: UuidSchema.optional(),
  project_id: UuidSchema.optional(),
  is_announcement_only: z.boolean().optional().default(false),
  /** User IDs to add as initial members */
  initial_member_ids: z.array(UuidSchema).max(100).optional().default([]),
});
export type CreateChannelRequest = z.infer<typeof CreateChannelRequestSchema>;

export const UpdateChannelRequestSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/)
    .optional(),
  topic: z.string().max(500).nullable().optional(),
  is_announcement_only: z.boolean().optional(),
});
export type UpdateChannelRequest = z.infer<typeof UpdateChannelRequestSchema>;

export const ConversationResponseSchema = ConversationSchema;
export const ConversationListResponseSchema = paginated(ConversationSchema);

// --- Memberships --------------------------------------------------------------

export const AddMemberRequestSchema = z.object({
  user_id: UuidSchema,
  role: MemberRoleSchema.optional().default("member"),
});
export type AddMemberRequest = z.infer<typeof AddMemberRequestSchema>;

export const UpdateMemberRequestSchema = z.object({
  role: MemberRoleSchema.optional(),
  notification_pref: NotificationPrefSchema.optional(),
  is_muted: z.boolean().optional(),
});
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

export const MembershipListResponseSchema = paginated(MembershipSchema);

// --- Direct Messages ----------------------------------------------------------

export const CreateDmRequestSchema = z.object({
  /** Exactly one user ID for DM, 2�8 for group DM */
  user_ids: z.array(UuidSchema).min(1).max(8),
});
export type CreateDmRequest = z.infer<typeof CreateDmRequestSchema>;

// --- Messages -----------------------------------------------------------------

export const SendMessageRequestSchema = z.object({
  /**
   * Client-generated UUID for idempotency.
   * The server enforces uniqueness per (sender, conversation).
   * Replaying with the same ID returns the original message with 200.
   */
  client_msg_id: UuidSchema,
  body: z.string().min(1).max(8000),
  parent_id: UuidSchema.optional(),
  attachment_ids: z.array(UuidSchema).max(10).optional().default([]),
  object_references: z
    .array(
      z.object({
        object_type: z.string().min(1).max(64),
        object_id: z.string().min(1).max(255),
        display_title: z.string().min(1).max(255),
        display_subtitle: z.string().max(255).optional(),
      }),
    )
    .max(5)
    .optional()
    .default([]),
  mention_ids: z.array(UuidSchema).max(50).optional().default([]),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const EditMessageRequestSchema = z.object({
  body: z.string().min(1).max(8000),
});
export type EditMessageRequest = z.infer<typeof EditMessageRequestSchema>;

export const MessageResponseSchema = MessageSchema;
export const MessageListResponseSchema = paginated(MessageSchema);

// --- Reactions ----------------------------------------------------------------

export const AddReactionRequestSchema = z.object({
  emoji: z.string().min(1).max(64),
});
export type AddReactionRequest = z.infer<typeof AddReactionRequestSchema>;

export const ReactionListResponseSchema = z.array(ReactionSummarySchema);

// --- Read State ---------------------------------------------------------------

export const MarkReadRequestSchema = z.object({
  last_read_message_id: UuidSchema.optional(),
});
export type MarkReadRequest = z.infer<typeof MarkReadRequestSchema>;

export const UnreadCountResponseSchema = z.object({
  conversation_id: UuidSchema,
  unread_count: z.number().int().nonnegative(),
  mention_count: z.number().int().nonnegative(),
});
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

// --- Attachments --------------------------------------------------------------

export const RequestUploadUrlRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(127),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024), // 100MB max
  /** SHA-256 of file content for integrity check after upload */
  checksum_sha256: z.string().length(64),
});
export type RequestUploadUrlRequest = z.infer<typeof RequestUploadUrlRequestSchema>;

export const UploadUrlResponseSchema = z.object({
  attachment_id: UuidSchema,
  upload_url: z.string().url(),
  upload_expires_at: z.string().datetime(),
  /** Fields to include in the multipart form POST */
  upload_fields: z.record(z.string()).optional(),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

export const FinalizeAttachmentRequestSchema = z.object({
  attachment_id: UuidSchema,
});
export type FinalizeAttachmentRequest = z.infer<typeof FinalizeAttachmentRequestSchema>;

// --- Search -------------------------------------------------------------------

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  conversation_id: UuidSchema.optional(),
  author_id: UuidSchema.optional(),
  has_file: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(50)),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResultItemSchema = z.object({
  message: MessageSchema,
  conversation: ConversationSchema.pick({ id: true, name: true, type: true }),
  /** HTML snippet with <mark> tags around matching terms */
  snippet: z.string(),
});

export const SearchResponseSchema = paginated(SearchResultItemSchema);

// --- Drafts -------------------------------------------------------------------

export const SaveDraftRequestSchema = z.object({
  body: z.string().max(8000),
});

// --- Notifications ------------------------------------------------------------

export const NotificationListResponseSchema = paginated(NotificationSchema);

// --- Object References --------------------------------------------------------

export const ObjectReferenceResponseSchema = ObjectReferenceSchema;

// --- Audit Log ----------------------------------------------------------------

export const AuditLogListResponseSchema = paginated(AuditLogSchema);

// --- Users --------------------------------------------------------------------

export const UserListResponseSchema = paginated(UserSchema);

// --- Webhook Endpoints --------------------------------------------------------

export const CreateWebhookEndpointRequestSchema = z.object({
  url: z.string().url(),
  description: z.string().max(500).optional(),
  events: z.array(WebhookEventTypeSchema).min(1),
});
export type CreateWebhookEndpointRequest = z.infer<typeof CreateWebhookEndpointRequestSchema>;

export const UpdateWebhookEndpointRequestSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(500).nullable().optional(),
  events: z.array(WebhookEventTypeSchema).min(1).optional(),
  is_active: z.boolean().optional(),
});

export const WebhookEndpointListResponseSchema = paginated(WebhookEndpointSchema);

// --- Health -------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  version: z.string(),
  checks: z.record(
    z.object({
      status: z.enum(["ok", "error"]),
      latency_ms: z.number().optional(),
      message: z.string().optional(),
    }),
  ),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
