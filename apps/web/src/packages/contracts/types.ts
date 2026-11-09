/**
 * @license
 * WorkOS Internal Communication System
 * Shared contracts, token claims, and TypeScript definitions.
 */

export type CommunicationPermission =
  | 'communication.access'
  | 'communication.channel.create'
  | 'communication.private_channel.create'
  | 'communication.channel.manage'
  | 'communication.member.manage'
  | 'communication.message.send'
  | 'communication.message.moderate'
  | 'communication.announcement.publish'
  | 'communication.audit.read';

export interface TokenClaims {
  sub: string;
  company_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  permissions: CommunicationPermission[];
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface User {
  id: string;
  company_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  initials: string;
  role_title: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  typing_in?: string | null;
}

export type ChannelType =
  | 'company'
  | 'department'
  | 'project'
  | 'public'
  | 'private'
  | 'announcement'
  | 'direct';

export interface WorkOSObjectRef {
  type: 'project' | 'task' | 'customer' | 'invoice' | 'document';
  id: string;
  title: string;
  status?: string;
  subtitle?: string;
  url?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  url: string;
  expires_at: number;
  thumbnail_url?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface Message {
  id: string;
  company_id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  sender_initials: string;
  content: string;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  thread_count: number;
  last_reply_at?: string;
  reactions: Reaction[];
  attachments: Attachment[];
  object_refs: WorkOSObjectRef[];
  mentions: string[];
  parent_message_id?: string;
  idempotency_key?: string;
  delivery_status?: 'sending' | 'delivered' | 'failed';
  is_pinned?: boolean;
  pinned_by?: string;
  pinned_at?: string;
}

export interface Channel {
  id: string;
  company_id: string;
  name: string;
  description: string;
  type: ChannelType;
  created_by: string;
  created_at: string;
  is_archived: boolean;
  member_ids: string[];
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
  topic?: string;
  linked_object?: WorkOSObjectRef;
  announcement_only?: boolean;
  pinned_message_ids?: string[];
}

export interface AuditEvent {
  id: string;
  company_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: 'channel' | 'message' | 'member' | 'attachment' | 'token';
  target_id: string;
  details: Record<string, unknown>;
  timestamp: string;
  ip_address: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  company_id: string;
  kind: 'mention' | 'reply' | 'dm' | 'channel_message' | 'channel_invite';
  conversation_id: string;
  message_id?: string;
  actor_id?: string;
  actor_name: string;
  actor_initials: string;
  preview: string;
  is_read: boolean;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  event: 'message.created' | 'mention.created' | 'channel.created' | 'thread.reply_created';
  company_id: string;
  timestamp: string;
  signature: string;
  payload: Record<string, unknown>;
}

export interface CommunicationAppProps {
  getAccessToken: () => Promise<string>;
  initialClaims?: TokenClaims;
  onOpenObject?: (obj: WorkOSObjectRef) => void;
  onCreateTask?: (context: { messageId: string; content: string; authorName: string }) => void;
  theme?: {
    primaryColor?: string;
    mode?: 'light' | 'dark';
    fontFamily?: string;
  };
  initialChannelId?: string;
  onNotificationClick?: (channelId: string, messageId?: string) => void;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  embedded?: boolean;
}

export interface SummaryDecision {
  decision: string;
  by: string | null;
}

export interface SummaryActionItem {
  task: string;
  assignee: string | null;
  due: string | null;
}

export interface SummaryData {
  overview: string;
  discussion_points: string[];
  decisions: SummaryDecision[];
  pending: string[];
  action_items: SummaryActionItem[];
  participants: string[];
}

export interface GenerateSummaryResponse {
  empty?: boolean;
  message?: string;
  summary?: SummaryData;
  cached?: boolean;
  cached_at?: string;
  created_at?: string;
  model?: string;
  message_count?: number;
  was_condensed?: boolean;
}

