/**
 * Drizzle ORM schema � every tenant table has company_id, indexes, and RLS enabled.
 * audit_log is append-only (enforced by DB trigger).
 * messages has unique(author_id, conversation_id, client_msg_id) for idempotent send.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  inet,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const conversationTypeEnum = pgEnum("conversation_type", ["dm", "group_dm", "channel"]);
export const channelKindEnum = pgEnum("channel_kind", [
  "company",
  "department",
  "project",
  "public",
  "private",
  "announcement",
]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);
export const notificationPrefEnum = pgEnum("notification_pref", ["all", "mentions", "nothing"]);
export const attachmentScanStatusEnum = pgEnum("attachment_scan_status", [
  "pending",
  "clean",
  "infected",
  "error",
]);
export const webhookEventTypeEnum = pgEnum("webhook_event_type", [
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
export const auditActionEnum = pgEnum("audit_action", [
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
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "delivered",
  "failed",
  "dead_letter",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    company_id: uuid("company_id").notNull(),
    name: text("name").notNull(),
    avatar_url: text("avatar_url"),
    department_ids: uuid("department_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    project_ids: uuid("project_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_company_id_idx").on(t.company_id)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    company_id: uuid("company_id").notNull(),
    type: conversationTypeEnum("type").notNull(),
    kind: channelKindEnum("kind"),
    name: text("name"),
    topic: text("topic"),
    is_archived: boolean("is_archived").notNull().default(false),
    is_announcement_only: boolean("is_announcement_only").notNull().default(false),
    department_id: uuid("department_id"),
    project_id: uuid("project_id"),
    member_count: integer("member_count").notNull().default(0),
    last_message_at: timestamp("last_message_at", { withTimezone: true }),
    created_by: uuid("created_by").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("conversations_company_id_idx").on(t.company_id),
    index("conversations_company_type_idx").on(t.company_id, t.type),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversation_id: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    user_id: uuid("user_id").notNull(),
    company_id: uuid("company_id").notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    last_read_message_id: uuid("last_read_message_id"),
    notification_pref: notificationPrefEnum("notification_pref").notNull().default("all"),
    is_muted: boolean("is_muted").notNull().default(false),
    joined_at: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_conversation_user_uidx").on(t.conversation_id, t.user_id),
    index("memberships_user_company_idx").on(t.user_id, t.company_id),
    index("memberships_company_id_idx").on(t.company_id),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversation_id: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    company_id: uuid("company_id").notNull(),
    author_id: uuid("author_id").notNull(),
    client_msg_id: uuid("client_msg_id").notNull(),
    seq: bigint("seq", { mode: "number" }).notNull(),
    body: text("body").notNull(),
    parent_id: uuid("parent_id"),
    reply_count: integer("reply_count").notNull().default(0),
    attachment_ids: uuid("attachment_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    mention_ids: uuid("mention_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    object_reference_ids: uuid("object_reference_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    edited_at: timestamp("edited_at", { withTimezone: true }),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    deleted_by: uuid("deleted_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conv_seq_idx").on(t.conversation_id, t.seq),
    index("messages_company_id_idx").on(t.company_id),
    index("messages_parent_id_idx").on(t.parent_id),
    uniqueIndex("messages_idempotency_uidx").on(t.author_id, t.conversation_id, t.client_msg_id),
  ],
);

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    message_id: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    conversation_id: uuid("conversation_id").notNull(),
    company_id: uuid("company_id").notNull(),
    user_id: uuid("user_id").notNull(),
    emoji: text("emoji").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reactions_unique_uidx").on(t.message_id, t.user_id, t.emoji),
    index("reactions_company_id_idx").on(t.company_id),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    company_id: uuid("company_id").notNull(),
    message_id: uuid("message_id"),
    uploader_id: uuid("uploader_id").notNull(),
    filename: text("filename").notNull(),
    mime_type: text("mime_type").notNull(),
    size_bytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum_sha256: text("checksum_sha256").notNull(),
    storage_key: text("storage_key").notNull(),
    scan_status: attachmentScanStatusEnum("scan_status").notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attachments_company_id_idx").on(t.company_id),
    index("attachments_message_id_idx").on(t.message_id),
  ],
);

export const objectReferences = pgTable(
  "object_references",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    company_id: uuid("company_id").notNull(),
    message_id: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    object_type: text("object_type").notNull(),
    object_id: text("object_id").notNull(),
    display_title: text("display_title").notNull(),
    display_subtitle: text("display_subtitle"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("obj_refs_company_id_idx").on(t.company_id)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversation_id: uuid("conversation_id").notNull(),
    user_id: uuid("user_id").notNull(),
    company_id: uuid("company_id").notNull(),
    body: text("body").notNull().default(""),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("drafts_conv_user_uidx").on(t.conversation_id, t.user_id),
    index("drafts_company_id_idx").on(t.company_id),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    user_id: uuid("user_id").notNull(),
    company_id: uuid("company_id").notNull(),
    kind: text("kind").notNull(),
    conversation_id: uuid("conversation_id").notNull(),
    message_id: uuid("message_id"),
    actor_id: uuid("actor_id"),
    is_read: boolean("is_read").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_company_idx").on(t.user_id, t.company_id),
    index("notifications_company_id_idx").on(t.company_id),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    company_id: uuid("company_id").notNull(),
    actor_id: uuid("actor_id").notNull(),
    action: auditActionEnum("action").notNull(),
    resource_type: text("resource_type").notNull(),
    resource_id: text("resource_id").notNull(),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'`),
    ip_address: inet("ip_address"),
    user_agent: text("user_agent"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_company_id_idx").on(t.company_id),
    index("audit_log_company_created_idx").on(t.company_id, t.created_at),
  ],
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    company_id: uuid("company_id").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    events: webhookEventTypeEnum("events").array().notNull(),
    is_active: boolean("is_active").notNull().default(true),
    created_by: uuid("created_by").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_company_id_idx").on(t.company_id)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    endpoint_id: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    company_id: uuid("company_id").notNull(),
    event_id: uuid("event_id").notNull(),
    event_type: webhookEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    last_attempted_at: timestamp("last_attempted_at", { withTimezone: true }),
    next_retry_at: timestamp("next_retry_at", { withTimezone: true }),
    response_status: integer("response_status"),
    response_body: text("response_body"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_company_id_idx").on(t.company_id),
    index("webhook_deliveries_next_retry_idx").on(t.next_retry_at),
  ],
);

export const messageSeqCounters = pgTable("message_seq_counters", {
  conversation_id: uuid("conversation_id")
    .primaryKey()
    .references(() => conversations.id, { onDelete: "cascade" }),
  last_seq: bigint("last_seq", { mode: "number" }).notNull().default(0),
});

export const messageMentions = pgTable(
  "message_mentions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    company_id: uuid("company_id").notNull(),
    conversation_id: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    message_id: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("message_mentions_unique_uidx").on(t.message_id, t.user_id),
    index("message_mentions_user_conv_idx").on(t.user_id, t.conversation_id),
    index("message_mentions_company_idx").on(t.company_id),
  ],
);
