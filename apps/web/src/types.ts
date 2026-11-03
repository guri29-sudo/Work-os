export * from './packages/contracts/types.js';

export interface MeResponse {
  id: string;
  company_id: string;
  name: string;
  avatar_url: string | null;
  permissions: string[];
  company: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface Conversation {
  id: string;
  company_id: string;
  type: 'channel' | 'dm' | 'group_dm';
  name: string | null;
  topic: string | null;
  kind: 'company' | 'department' | 'project' | 'public' | 'private' | 'announcement' | null;
  is_archived: boolean;
  is_announcement_only: boolean;
  member_count?: number | undefined;
  unread_count?: number | undefined;
  last_message_at: string | null;
  dm_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    presence?: 'online' | 'idle' | 'dnd' | 'offline';
    role?: string;
  } | undefined;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
  reacted_by_me?: boolean | undefined;
}

export interface AttachmentInfo {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  download_url?: string | undefined;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  conversation_id: string;
  message_id: string | null;
  actor_id: string | null;
  actor_name?: string | null | undefined;
  actor_avatar_url?: string | null | undefined;
  conversation_name?: string | null | undefined;
  message_snippet?: string | null | undefined;
  is_read: boolean;
  created_at: string;
}
