/**
 * Real-time WebSocket event schemas.
 * All events are versioned; breaking changes create new types.
 * Server sends these; clients listen for them.
 *
 * Event envelope:
 *   { v: 1, type: "<event.type>", payload: {...}, company_id: "...", ts: "<iso>" }
 */
import { z } from "zod";
import {
  MessageSchema,
  ReactionSummarySchema,
  ConversationSchema,
  MembershipSchema,
  NotificationSchema,
  UuidSchema,
  TimestampSchema,
} from "./entities.js";

const EVENT_VERSION = 1 as const;

function eventEnvelope<T extends z.ZodTypeAny>(type: string, payloadSchema: T) {
  return z.object({
    v: z.literal(EVENT_VERSION),
    type: z.literal(type),
    company_id: UuidSchema,
    ts: TimestampSchema,
    payload: payloadSchema,
  });
}

// --- Message events -----------------------------------------------------------

export const MessageCreatedEventSchema = eventEnvelope(
  "message.created",
  z.object({ message: MessageSchema }),
);
export type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;

export const MessageUpdatedEventSchema = eventEnvelope(
  "message.updated",
  z.object({
    message_id: UuidSchema,
    conversation_id: UuidSchema,
    body: z.string(),
    edited_at: TimestampSchema,
  }),
);
export type MessageUpdatedEvent = z.infer<typeof MessageUpdatedEventSchema>;

export const MessageDeletedEventSchema = eventEnvelope(
  "message.deleted",
  z.object({
    message_id: UuidSchema,
    conversation_id: UuidSchema,
    deleted_at: TimestampSchema,
    deleted_by: UuidSchema,
  }),
);
export type MessageDeletedEvent = z.infer<typeof MessageDeletedEventSchema>;

// --- Reaction events ----------------------------------------------------------

export const ReactionAddedEventSchema = eventEnvelope(
  "reaction.added",
  z.object({
    message_id: UuidSchema,
    conversation_id: UuidSchema,
    user_id: UuidSchema,
    emoji: z.string(),
    summary: ReactionSummarySchema,
  }),
);
export type ReactionAddedEvent = z.infer<typeof ReactionAddedEventSchema>;

export const ReactionRemovedEventSchema = eventEnvelope(
  "reaction.removed",
  z.object({
    message_id: UuidSchema,
    conversation_id: UuidSchema,
    user_id: UuidSchema,
    emoji: z.string(),
    summary: ReactionSummarySchema,
  }),
);
export type ReactionRemovedEvent = z.infer<typeof ReactionRemovedEventSchema>;

// --- Thread events ------------------------------------------------------------

export const ThreadReplyCountChangedEventSchema = eventEnvelope(
  "thread.reply_count_changed",
  z.object({
    parent_message_id: UuidSchema,
    conversation_id: UuidSchema,
    reply_count: z.number().int().nonnegative(),
    latest_reply_at: TimestampSchema,
  }),
);
export type ThreadReplyCountChangedEvent = z.infer<
  typeof ThreadReplyCountChangedEventSchema
>;

// --- Typing events (ephemeral, not stored) ------------------------------------

export const TypingStartedEventSchema = eventEnvelope(
  "typing.started",
  z.object({
    conversation_id: UuidSchema,
    user_id: UuidSchema,
    user_name: z.string(),
  }),
);
export type TypingStartedEvent = z.infer<typeof TypingStartedEventSchema>;

export const TypingStoppedEventSchema = eventEnvelope(
  "typing.stopped",
  z.object({
    conversation_id: UuidSchema,
    user_id: UuidSchema,
  }),
);
export type TypingStoppedEvent = z.infer<typeof TypingStoppedEventSchema>;

// --- Presence events ----------------------------------------------------------

export const PresenceStatusSchema = z.enum(["online", "away", "offline"]);
export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;

export const PresenceChangedEventSchema = eventEnvelope(
  "presence.changed",
  z.object({
    user_id: UuidSchema,
    status: PresenceStatusSchema,
  }),
);
export type PresenceChangedEvent = z.infer<typeof PresenceChangedEventSchema>;

// --- Read state events --------------------------------------------------------

export const ReadUpdatedEventSchema = eventEnvelope(
  "read.updated",
  z.object({
    conversation_id: UuidSchema,
    user_id: UuidSchema,
    last_read_message_id: UuidSchema,
    last_read_at: TimestampSchema,
  }),
);
export type ReadUpdatedEvent = z.infer<typeof ReadUpdatedEventSchema>;

export const UnreadChangedEventSchema = eventEnvelope(
  "unread.changed",
  z.object({
    conversation_id: UuidSchema,
    unread_count: z.number().int().nonnegative(),
    mention_count: z.number().int().nonnegative(),
  }),
);
export type UnreadChangedEvent = z.infer<typeof UnreadChangedEventSchema>;

// --- Channel events -----------------------------------------------------------

export const ChannelUpdatedEventSchema = eventEnvelope(
  "channel.updated",
  z.object({ conversation: ConversationSchema }),
);
export type ChannelUpdatedEvent = z.infer<typeof ChannelUpdatedEventSchema>;

export const ChannelArchivedEventSchema = eventEnvelope(
  "channel.archived",
  z.object({
    conversation_id: UuidSchema,
    archived_at: TimestampSchema,
    archived_by: UuidSchema,
  }),
);
export type ChannelArchivedEvent = z.infer<typeof ChannelArchivedEventSchema>;

// --- Membership events --------------------------------------------------------

export const MembershipChangedEventSchema = eventEnvelope(
  "membership.changed",
  z.object({
    conversation_id: UuidSchema,
    membership: MembershipSchema,
    change_type: z.enum(["added", "removed", "updated"]),
  }),
);
export type MembershipChangedEvent = z.infer<
  typeof MembershipChangedEventSchema
>;

// --- Notification events ------------------------------------------------------

export const NotificationCreatedEventSchema = eventEnvelope(
  "notification.created",
  z.object({ notification: NotificationSchema }),
);
export type NotificationCreatedEvent = z.infer<
  typeof NotificationCreatedEventSchema
>;

// --- Client ? Server messages -------------------------------------------------

/** Subscribe to a conversation's real-time updates */
export const WsSubscribeSchema = z.object({
  type: z.literal("subscribe"),
  conversation_id: UuidSchema,
  /** Resume from this cursor (last received seq) on reconnect */
  cursor: z.number().int().nonnegative().optional(),
});
export type WsSubscribe = z.infer<typeof WsSubscribeSchema>;

/** Unsubscribe from a conversation */
export const WsUnsubscribeSchema = z.object({
  type: z.literal("unsubscribe"),
  conversation_id: UuidSchema,
});
export type WsUnsubscribe = z.infer<typeof WsUnsubscribeSchema>;

/** Send a typing indicator (throttled to 1/3s) */
export const WsTypingSchema = z.object({
  type: z.literal("typing"),
  conversation_id: UuidSchema,
});
export type WsTyping = z.infer<typeof WsTypingSchema>;

/** Heartbeat from client ? server */
export const WsPingSchema = z.object({ type: z.literal("ping") });
export type WsPing = z.infer<typeof WsPingSchema>;

/** Server ? client pong */
export const WsPongSchema = z.object({
  type: z.literal("pong"),
  server_ts: TimestampSchema,
});

/** Auth handshake – first message from client */
export const WsAuthSchema = z.object({
  type: z.literal("auth"),
  token: z.string().min(1),
});
export type WsAuth = z.infer<typeof WsAuthSchema>;

/** Auth success response */
export const WsAuthAckSchema = z.object({
  type: z.literal("auth_ack"),
  user_id: UuidSchema,
  company_id: UuidSchema,
});

/** Auth failure response */
export const WsAuthErrorSchema = z.object({
  type: z.literal("auth_error"),
  code: z.string(),
  message: z.string(),
});

/** Union of all server-sent event types */
export const ServerEventSchema = z.discriminatedUnion("type", [
  MessageCreatedEventSchema,
  MessageUpdatedEventSchema,
  MessageDeletedEventSchema,
  ReactionAddedEventSchema,
  ReactionRemovedEventSchema,
  ThreadReplyCountChangedEventSchema,
  TypingStartedEventSchema,
  TypingStoppedEventSchema,
  PresenceChangedEventSchema,
  ReadUpdatedEventSchema,
  UnreadChangedEventSchema,
  ChannelUpdatedEventSchema,
  ChannelArchivedEventSchema,
  MembershipChangedEventSchema,
  NotificationCreatedEventSchema,
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;

/** Union of all client-sent message types */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  WsAuthSchema,
  WsSubscribeSchema,
  WsUnsubscribeSchema,
  WsTypingSchema,
  WsPingSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
