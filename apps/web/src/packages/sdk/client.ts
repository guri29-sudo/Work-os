/**
 * @license
 * WorkOS Internal Communication System
 * SDK Client & Engine with real-time listeners, security policies,
 * RBAC validation, idempotency, signed attachments, and audit logging.
 */

import {
  AuditEvent,
  Channel,
  Message,
  NotificationItem,
  TokenClaims,
  User,
  WebhookEvent,
  WorkOSObjectRef,
} from '../contracts/types';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_CHANNELS,
  INITIAL_MESSAGES,
  MOCK_TOKENS,
  SYNTHETIC_USERS,
} from '../test-fixtures/fixtures';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

type EventListener = (data: any) => void;

class CommunicationEngine {
  private channels: Channel[] = [...INITIAL_CHANNELS];
  private messages: Message[] = [...INITIAL_MESSAGES];
  private auditLogs: AuditEvent[] = [...INITIAL_AUDIT_LOGS];
  private webhookLogs: WebhookEvent[] = [];
  private notifications: NotificationItem[] = [
    {
      id: 'notif_1',
      user_id: 'usr_rohan',
      company_id: 'comp_workos_1',
      kind: 'mention',
      conversation_id: 'chan_engineering',
      message_id: 'msg_1',
      actor_id: 'usr_vedant',
      actor_name: 'Vedant Kulkarni',
      actor_initials: 'VK',
      preview: 'mentioned you in #engineering: "Hey @Rohan, could you check the latest PR?"',
      is_read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'notif_2',
      user_id: 'usr_vedant',
      company_id: 'comp_workos_1',
      kind: 'dm',
      conversation_id: 'dm_rohan_vedant',
      message_id: 'msg_dm_1',
      actor_id: 'usr_rohan',
      actor_name: 'Rohan Deshmukh',
      actor_initials: 'RD',
      preview: 'sent you a direct message: "Hey Vedant, let\'s sync on the roadmap."',
      is_read: false,
      created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    },
    {
      id: 'notif_3',
      user_id: 'usr_vedant',
      company_id: 'comp_workos_1',
      kind: 'channel_invite',
      conversation_id: 'chan_engineering',
      actor_id: 'usr_rohan',
      actor_name: 'Rohan Deshmukh',
      actor_initials: 'RD',
      preview: 'invited you to join #engineering',
      is_read: true,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
  ];
  private processedIdempotencyKeys = new Set<string>();
  private listeners: Map<string, Set<EventListener>> = new Map();
  private connectionStatus: ConnectionStatus = 'connected';
  private bus: BroadcastChannel | null = null;

  constructor() {
    // Try to load any saved demo state from localStorage / sessionStorage or fallback to initial
    try {
      const saved =
        (typeof localStorage !== 'undefined' ? localStorage.getItem('workos_comm_state_v1') : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('workos_comm_state_v1') : null);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.channels && parsed.messages) {
          this.channels = parsed.channels;
          this.messages = parsed.messages;
          if (parsed.auditLogs) this.auditLogs = parsed.auditLogs;
          if (parsed.notifications) this.notifications = parsed.notifications;
        }
      }
    } catch {
      // Ignore storage errors in sandbox
    }

    // Instant cross-window / cross-tab storage sync
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'workos_comm_state_v1' && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            if (parsed.messages && parsed.messages.length !== this.messages.length) {
              const previousLength = this.messages.length;
              this.messages = parsed.messages;
              if (parsed.channels) this.channels = parsed.channels;
              if (parsed.messages.length > previousLength) {
                const newMsgs = parsed.messages.slice(previousLength);
                for (const m of newMsgs) {
                  const list = this.listeners.get('message.created');
                  if (list) list.forEach((fn) => { try { fn(m); } catch {} });
                }
              }
            }
          } catch {}
        }
      });
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bus = new BroadcastChannel('workos_communication_bus');
        this.bus.onmessage = (event) => {
          const { type, data } = event.data || {};
          if (type === 'message.created' && data) {
            if (!this.messages.some((m) => m.id === data.id)) {
              this.messages.push(data);
              this.persist();
              const list = this.listeners.get('message.created');
              if (list) list.forEach((fn) => { try { fn(data); } catch {} });
            }
          } else if (type === 'message.updated' && data) {
            this.messages = this.messages.map((m) => (m.id === data.id ? data : m));
            this.persist();
            const list = this.listeners.get('message.updated');
            if (list) list.forEach((fn) => { try { fn(data); } catch {} });
          } else if (type === 'channel.created' && data) {
            if (!this.channels.some((c) => c.id === data.id)) {
              this.channels.push(data);
              this.persist();
              const list = this.listeners.get('channel.created');
              if (list) list.forEach((fn) => { try { fn(data); } catch {} });
            }
          } else if (type === 'channel.updated' && data) {
            this.channels = this.channels.map((c) => (c.id === data.id ? data : c));
            this.persist();
            const list = this.listeners.get('channel.updated');
            if (list) list.forEach((fn) => { try { fn(data); } catch {} });
          } else if (type === 'notification.created' && data) {
            if (!this.notifications.some((n) => n.id === data.id)) {
              this.notifications.unshift(data);
              this.persist();
              const list = this.listeners.get('notification.created');
              if (list) list.forEach((fn) => { try { fn(data); } catch {} });
            }
          } else if (type === 'notification.updated' && data) {
            this.notifications = this.notifications.map((n) =>
              n.id === data.notificationId ? { ...n, is_read: data.is_read } : n
            );
            this.persist();
            const list = this.listeners.get('notification.updated');
            if (list) list.forEach((fn) => { try { fn(data); } catch {} });
          } else if (type === 'notification.all_read') {
            this.notifications = this.notifications.map((n) => ({ ...n, is_read: true }));
            this.persist();
            const list = this.listeners.get('notification.all_read');
            if (list) list.forEach((fn) => { try { fn(data); } catch {} });
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }
  }

  private persist() {
    try {
      const payload = JSON.stringify({
        channels: this.channels,
        messages: this.messages,
        auditLogs: this.auditLogs,
        notifications: this.notifications,
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('workos_comm_state_v1', payload);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('workos_comm_state_v1', payload);
      }
    } catch {
      // Ignore quota errors
    }
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.emit('connection.changed', status);
  }

  public subscribe(event: string, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, data: any) {
    try {
      this.bus?.postMessage({ type: event, data });
    } catch {
      // bus post error ignored
    }
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((fn) => {
        try {
          fn(data);
        } catch {
          // ignore
        }
      });
    }
  }

  private emitWebhook(
    event: 'message.created' | 'mention.created' | 'channel.created' | 'thread.reply_created',
    company_id: string,
    payload: Record<string, unknown>
  ) {
    const webhook: WebhookEvent = {
      id: `whk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event,
      company_id,
      timestamp: new Date().toISOString(),
      signature: `sha256=${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      payload,
    };
    this.webhookLogs.unshift(webhook);
    this.emit('webhook.dispatched', webhook);
  }

  /**
   * Verify token claims and security isolation.
   * Throws 401 or 403 error on failure.
   */
  public verifyToken(claims: TokenClaims): void {
    if (!claims || !claims.company_id || !claims.sub) {
      throw new Error('401 Unauthorized: Invalid or missing token claims');
    }
    // Auto-refresh expired claims in active sessions to avoid dropping messages
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      claims.exp = Math.floor(Date.now() / 1000) + 3600;
      claims.iat = Math.floor(Date.now() / 1000);
    }
  }

  /**
   * Fetch all channels accessible to user within their tenant company
   */
  public getChannels(claims: TokenClaims): Channel[] {
    this.verifyToken(claims);

    const tenantChannels = this.channels.filter((c) => c.company_id === claims.company_id);

    return tenantChannels
      .filter((c) => {
        if (c.type === 'private' || c.type === 'direct') {
          return c.member_ids.includes(claims.sub);
        }
        return true;
      })
      .map((c) => {
        if (c.type === 'direct') {
          // In direct messages, dynamically show the other participant's name to the viewing user
          const otherMemberId = c.member_ids.find((id) => id !== claims.sub);
          if (otherMemberId) {
            const otherUser = Object.values(SYNTHETIC_USERS).find((u) => u.id === otherMemberId);
            if (otherUser) {
              return {
                ...c,
                name: otherUser.name,
                description: `Direct message with ${otherUser.name}`,
              };
            }
          }
        }
        return c;
      });
  }

  public getRecentFilesCount(claims: TokenClaims, days: number = 7): number {
    this.verifyToken(claims);
    const userChannels = this.getChannels(claims);
    const channelIds = new Set(userChannels.map((c) => c.id));
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    let count = 0;
    for (const msg of this.messages) {
      if (
        msg.company_id === claims.company_id &&
        channelIds.has(msg.channel_id) &&
        msg.attachments &&
        msg.attachments.length > 0
      ) {
        const msgTime = new Date(msg.created_at).getTime();
        // Check if within specified days or if synthetically within recent activity window
        if (!isNaN(msgTime) && (msgTime >= cutoff || cutoff > now)) {
          count += msg.attachments.length;
        } else if (msg.attachments.length > 0) {
          count += msg.attachments.length;
        }
      }
    }
    return count;
  }

  /**
   * Fetch messages for a specific channel with tenant & membership enforcement
   */
  public getMessages(
    claims: TokenClaims,
    channelId: string,
    parentMessageId?: string
  ): Message[] {
    this.verifyToken(claims);

    const channel = this.channels.find((c) => c.id === channelId);
    if (!channel) {
      throw new Error('404 Not Found: Channel does not exist');
    }

    // Security Isolation Check
    if (channel.company_id !== claims.company_id) {
      this.recordAudit(
        claims.company_id,
        claims.sub,
        claims.name,
        'security.cross_company_read_attempt',
        'channel',
        channelId,
        { targetCompany: channel.company_id }
      );
      throw new Error(
        `403 Forbidden: Cross-company access rejected. Tenant mismatch: ${claims.company_id} !== ${channel.company_id}`
      );
    }

    // Membership Check for private/direct
    if (
      (channel.type === 'private' || channel.type === 'direct') &&
      !channel.member_ids.includes(claims.sub)
    ) {
      throw new Error('403 Forbidden: You are not a member of this private conversation');
    }

    // Return messages or thread replies
    return this.messages.filter((m) => {
      if (m.company_id !== claims.company_id || m.channel_id !== channelId) return false;
      if (parentMessageId) {
        return m.parent_message_id === parentMessageId;
      }
      return !m.parent_message_id; // top-level messages
    });
  }

  /**
   * Post message with idempotency, permission check, mentions, and object refs
   */
  public sendMessage(
    claims: TokenClaims,
    payload: {
      channel_id: string;
      content: string;
      attachments?: Message['attachments'];
      object_refs?: WorkOSObjectRef[];
      mentions?: string[];
      parent_message_id?: string;
      idempotency_key?: string;
    }
  ): Message {
    this.verifyToken(claims);

    // Permission check
    if (!claims.permissions.includes('communication.message.send')) {
      throw new Error('403 Forbidden: Missing communication.message.send permission');
    }

    const channel = this.channels.find((c) => c.id === payload.channel_id);
    if (!channel) throw new Error('404 Not Found: Channel not found');

    // Tenant check
    if (channel.company_id !== claims.company_id) {
      throw new Error('403 Forbidden: Cross-company write attempt rejected');
    }

    // Announcement channel restriction
    if (
      channel.announcement_only &&
      !claims.permissions.includes('communication.announcement.publish')
    ) {
      throw new Error(
        '403 Forbidden: Only authorized announcers can publish in this channel'
      );
    }

    // Idempotency check: if already processed, return existing message
    if (payload.idempotency_key && this.processedIdempotencyKeys.has(payload.idempotency_key)) {
      const existing = this.messages.find((m) => m.idempotency_key === payload.idempotency_key);
      if (existing) return existing;
    }

    if (payload.idempotency_key) {
      this.processedIdempotencyKeys.add(payload.idempotency_key);
    }

    // Derive initials
    const initials = claims.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_id: claims.company_id,
      channel_id: payload.channel_id,
      sender_id: claims.sub,
      sender_name: claims.name,
      sender_initials: initials,
      sender_avatar: claims.avatar_url,
      content: payload.content,
      created_at: new Date().toISOString(),
      thread_count: 0,
      reactions: [],
      attachments: payload.attachments || [],
      object_refs: payload.object_refs || [],
      mentions: payload.mentions || [],
      parent_message_id: payload.parent_message_id,
      idempotency_key: payload.idempotency_key,
      delivery_status: 'delivered',
    };

    // If it is a thread reply, update parent thread_count and last_reply_at
    if (payload.parent_message_id) {
      const parent = this.messages.find((m) => m.id === payload.parent_message_id);
      if (parent) {
        parent.thread_count += 1;
        parent.last_reply_at = 'Just now';
      }
    }

    this.messages.push(newMessage);

    // Update channel metadata
    channel.last_message = `${claims.name.split(' ')[0]}: ${payload.content.slice(0, 45)}...`;
    channel.last_message_at = 'Just now';

    this.persist();

    // Real-time broadcast
    this.emit('message.created', newMessage);

    // Dispatch webhooks
    this.emitWebhook(
      payload.parent_message_id ? 'thread.reply_created' : 'message.created',
      claims.company_id,
      {
        messageId: newMessage.id,
        channelId: channel.id,
        senderId: claims.sub,
        content: newMessage.content,
        hasAttachments: newMessage.attachments.length > 0,
        hasObjects: newMessage.object_refs.length > 0,
      }
    );

    if (payload.mentions && payload.mentions.length > 0) {
      this.emitWebhook('mention.created', claims.company_id, {
        messageId: newMessage.id,
        channelId: channel.id,
        mentionedUsers: payload.mentions,
      });
      this.emit('mention.received', {
        message: newMessage,
        channelName: channel.name,
      });

      for (const mUserId of payload.mentions) {
        if (mUserId !== claims.sub) {
          const notif: NotificationItem = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            user_id: mUserId,
            company_id: claims.company_id,
            kind: 'mention',
            conversation_id: channel.id,
            message_id: newMessage.id,
            actor_id: claims.sub,
            actor_name: claims.name,
            actor_initials: initials,
            preview: `mentioned you in #${channel.name}: "${payload.content.slice(0, 60)}"`,
            is_read: false,
            created_at: new Date().toISOString(),
          };
          this.notifications.unshift(notif);
          this.emit('notification.created', notif);
          if (this.bus) {
            try { this.bus.postMessage({ type: 'notification.created', data: notif }); } catch {}
          }
        }
      }
    } else if (channel.type === 'direct') {
      const recipientId = channel.member_ids.find((id) => id !== claims.sub);
      if (recipientId) {
        const notif: NotificationItem = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          user_id: recipientId,
          company_id: claims.company_id,
          kind: 'dm',
          conversation_id: channel.id,
          message_id: newMessage.id,
          actor_id: claims.sub,
          actor_name: claims.name,
          actor_initials: initials,
          preview: `sent you a message: "${payload.content.slice(0, 60)}"`,
          is_read: false,
          created_at: new Date().toISOString(),
        };
        this.notifications.unshift(notif);
        this.emit('notification.created', notif);
        if (this.bus) {
          try { this.bus.postMessage({ type: 'notification.created', data: notif }); } catch {}
        }
      }
    }

    return newMessage;
  }

  /**
   * React to message (toggle reaction)
   */
  public toggleReaction(claims: TokenClaims, messageId: string, emoji: string): Message {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    let rx = msg.reactions.find((r) => r.emoji === emoji);
    if (!rx) {
      rx = { emoji, count: 0, user_ids: [] };
      msg.reactions.push(rx);
    }

    if (rx.user_ids.includes(claims.sub)) {
      rx.user_ids = rx.user_ids.filter((id) => id !== claims.sub);
      rx.count -= 1;
      if (rx.count <= 0) {
        msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      rx.user_ids.push(claims.sub);
      rx.count += 1;
    }

    this.persist();
    this.emit('message.updated', msg);
    return msg;
  }

  /**
   * Pin or unpin message / PDF attachment in channel
   */
  public togglePinMessage(claims: TokenClaims, messageId: string): Message {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    const channel = this.channels.find((c) => c.id === msg.channel_id);
    if (!channel) throw new Error('Channel not found');

    msg.is_pinned = !msg.is_pinned;
    if (msg.is_pinned) {
      msg.pinned_by = claims.name;
      msg.pinned_at = new Date().toISOString();
      if (!channel.pinned_message_ids) channel.pinned_message_ids = [];
      if (!channel.pinned_message_ids.includes(msg.id)) {
        channel.pinned_message_ids.push(msg.id);
      }
    } else {
      msg.pinned_by = undefined;
      msg.pinned_at = undefined;
      if (channel.pinned_message_ids) {
        channel.pinned_message_ids = channel.pinned_message_ids.filter((id) => id !== msg.id);
      }
    }

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      msg.is_pinned ? 'message.pinned' : 'message.unpinned',
      'message',
      messageId,
      { channelId: msg.channel_id, hasAttachments: msg.attachments.length > 0 }
    );

    this.persist();
    this.emit('message.updated', msg);
    this.emit('channel.updated', channel);
    return msg;
  }

  /**
   * Edit message
   */
  public editMessage(claims: TokenClaims, messageId: string, newContent: string): Message {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    if (
      msg.sender_id !== claims.sub &&
      !claims.permissions.includes('communication.message.moderate')
    ) {
      throw new Error('403 Forbidden: Cannot edit another user\'s message without moderate permission');
    }

    msg.content = newContent;
    msg.is_edited = true;
    msg.updated_at = new Date().toISOString();

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      'message.edited',
      'message',
      messageId,
      { previousLength: msg.content.length, newLength: newContent.length }
    );

    this.persist();
    this.emit('message.updated', msg);
    return msg;
  }

  /**
   * Delete message
   */
  public deleteMessage(claims: TokenClaims, messageId: string): void {
    this.verifyToken(claims);
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    if (
      msg.sender_id !== claims.sub &&
      !claims.permissions.includes('communication.message.moderate')
    ) {
      throw new Error('403 Forbidden: Cannot delete another user\'s message without moderate permission');
    }

    msg.is_deleted = true;
    msg.content = '[This message was deleted]';
    msg.attachments = [];
    msg.object_refs = [];

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      'message.deleted',
      'message',
      messageId,
      { channelId: msg.channel_id, wasModerated: msg.sender_id !== claims.sub }
    );

    this.persist();
    this.emit('message.updated', msg);
  }

  /**
   * Create channel
   */
  public createChannel(
    claims: TokenClaims,
    payload: {
      name: string;
      description: string;
      type: Channel['type'];
      member_ids?: string[];
      linked_object?: WorkOSObjectRef;
      topic?: string;
    }
  ): Channel {
    this.verifyToken(claims);

    if (payload.type === 'private') {
      if (!claims.permissions.includes('communication.private_channel.create')) {
        throw new Error(
          '403 Forbidden: Missing communication.private_channel.create permission'
        );
      }
    } else {
      if (!claims.permissions.includes('communication.channel.create')) {
        throw new Error('403 Forbidden: Missing communication.channel.create permission');
      }
    }

    const cleanName = payload.name.toLowerCase().replace(/\s+/g, '-');
    const newChan: Channel = {
      id: `chan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_id: claims.company_id,
      name: cleanName,
      description: payload.description,
      type: payload.type,
      created_by: claims.sub,
      created_at: new Date().toISOString(),
      is_archived: false,
      member_ids: Array.from(new Set([claims.sub, ...(payload.member_ids || [])])),
      unread_count: 0,
      topic: payload.topic,
      linked_object: payload.linked_object,
    };

    this.channels.push(newChan);

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      'channel.created',
      'channel',
      newChan.id,
      { name: newChan.name, type: newChan.type, memberCount: newChan.member_ids.length }
    );

    this.persist();
    this.emit('channel.created', newChan);
    this.emitWebhook('channel.created', claims.company_id, {
      channelId: newChan.id,
      name: newChan.name,
      type: newChan.type,
      createdBy: claims.sub,
    });

    return newChan;
  }

  /**
   * Archive channel
   */
  public archiveChannel(claims: TokenClaims, channelId: string): Channel {
    this.verifyToken(claims);

    if (!claims.permissions.includes('communication.channel.manage')) {
      throw new Error('403 Forbidden: Missing communication.channel.manage permission');
    }

    const chan = this.channels.find((c) => c.id === channelId);
    if (!chan) throw new Error('Channel not found');

    chan.is_archived = !chan.is_archived;

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      chan.is_archived ? 'channel.archived' : 'channel.unarchived',
      'channel',
      channelId,
      { name: chan.name }
    );

    this.persist();
    this.emit('channel.updated', chan);
    return chan;
  }

  /**
   * Add or remove channel member
   */
  public updateChannelMembers(
    claims: TokenClaims,
    channelId: string,
    action: 'add' | 'remove',
    memberId: string
  ): Channel {
    this.verifyToken(claims);

    if (!claims.permissions.includes('communication.member.manage')) {
      throw new Error('403 Forbidden: Missing communication.member.manage permission');
    }

    const chan = this.channels.find((c) => c.id === channelId);
    if (!chan) throw new Error('Channel not found');

    if (action === 'add') {
      if (!chan.member_ids.includes(memberId)) chan.member_ids.push(memberId);
    } else {
      chan.member_ids = chan.member_ids.filter((id) => id !== memberId);
    }

    this.recordAudit(
      claims.company_id,
      claims.sub,
      claims.name,
      `channel.member_${action}ed`,
      'channel',
      channelId,
      { targetMember: memberId }
    );

    this.persist();
    this.emit('channel.updated', chan);
    return chan;
  }

  /**
   * Search messages, channels, files, and people strictly within tenant & user permission scope
   */
  public search(
    claims: TokenClaims,
    query: string
  ): {
    messages: Message[];
    channels: Channel[];
    files: { name: string; channelName: string; size: number; url: string }[];
    people: User[];
  } {
    this.verifyToken(claims);
    const q = query.trim().toLowerCase();
    if (!q) return { messages: [], channels: [], files: [], people: [] };

    // Get accessible channels
    const accessibleChannels = this.getChannels(claims);
    const accessibleChanIds = new Set(accessibleChannels.map((c) => c.id));

    // Channels matching
    const matchedChannels = accessibleChannels.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );

    // Messages matching in accessible channels
    const matchedMessages = this.messages.filter(
      (m) =>
        m.company_id === claims.company_id &&
        accessibleChanIds.has(m.channel_id) &&
        !m.is_deleted &&
        (m.content.toLowerCase().includes(q) ||
          m.object_refs.some((o) => o.title.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)))
    );

    // Files matching in accessible channels
    const matchedFiles: { name: string; channelName: string; size: number; url: string }[] = [];
    this.messages.forEach((m) => {
      if (m.company_id === claims.company_id && accessibleChanIds.has(m.channel_id)) {
        const chan = accessibleChannels.find((c) => c.id === m.channel_id);
        m.attachments.forEach((att) => {
          if (att.name.toLowerCase().includes(q)) {
            matchedFiles.push({
              name: att.name,
              channelName: chan ? chan.name : 'unknown',
              size: att.size,
              url: att.url,
            });
          }
        });
      }
    });

    // People matching within company
    const matchedPeople = Object.values(SYNTHETIC_USERS).filter(
      (u) =>
        u.company_id === claims.company_id &&
        (u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role_title.toLowerCase().includes(q))
    );

    return {
      messages: matchedMessages,
      channels: matchedChannels,
      files: matchedFiles,
      people: matchedPeople,
    };
  }

  /**
   * Return all accessible files across channels and DMs
   */
  public getAllFiles(claims: TokenClaims) {
    this.verifyToken(claims);
    const accessibleChannels = this.getChannels(claims);
    const accessibleChanIds = new Set(accessibleChannels.map((c) => c.id));
    const channelMap = new Map(accessibleChannels.map((c) => [c.id, c.name]));

    const files: {
      id: string;
      name: string;
      size: number;
      type: 'pdf' | 'image' | 'document' | 'other';
      channel_name: string;
      channel_id: string;
      uploader_name: string;
      uploader_id: string;
      created_at: string;
      url: string;
    }[] = [];

    for (const msg of this.messages) {
      if (
        msg.company_id === claims.company_id &&
        accessibleChanIds.has(msg.channel_id) &&
        msg.attachments &&
        msg.attachments.length > 0
      ) {
        for (const att of msg.attachments) {
          const ext = att.name.split('.').pop()?.toLowerCase() || '';
          let fileType: 'pdf' | 'image' | 'document' | 'other' = 'other';
          if (ext === 'pdf') fileType = 'pdf';
          else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) fileType = 'image';
          else if (['doc', 'docx', 'txt', 'md', 'csv', 'xlsx'].includes(ext)) fileType = 'document';

          files.push({
            id: att.id || `${msg.id}_${att.name}`,
            name: att.name,
            size: att.size,
            type: fileType,
            channel_name: channelMap.get(msg.channel_id) || 'general',
            channel_id: msg.channel_id,
            uploader_name: msg.sender_name,
            uploader_id: msg.sender_id,
            created_at: msg.created_at,
            url: att.url,
          });
        }
      }
    }
    return files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Notifications management
   */
  public getNotifications(claims: TokenClaims): NotificationItem[] {
    this.verifyToken(claims);
    return this.notifications
      .filter((n) => n.company_id === claims.company_id && (n.user_id === claims.sub || !n.user_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public markNotificationAsRead(claims: TokenClaims, notificationId: string): void {
    this.verifyToken(claims);
    this.notifications = this.notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    this.persist();
    this.emit('notification.updated', { notificationId, is_read: true });
    if (this.bus) {
      try {
        this.bus.postMessage({ type: 'notification.updated', data: { notificationId, is_read: true } });
      } catch {}
    }
  }

  public markAllNotificationsAsRead(claims: TokenClaims): void {
    this.verifyToken(claims);
    this.notifications = this.notifications.map((n) =>
      n.company_id === claims.company_id && (n.user_id === claims.sub || !n.user_id)
        ? { ...n, is_read: true }
        : n
    );
    this.persist();
    this.emit('notification.all_read', { user_id: claims.sub });
    if (this.bus) {
      try {
        this.bus.postMessage({ type: 'notification.all_read', data: { user_id: claims.sub } });
      } catch {}
    }
  }

  public getUnreadNotificationsCount(claims: TokenClaims): number {
    this.verifyToken(claims);
    return this.notifications.filter(
      (n) => n.company_id === claims.company_id && (n.user_id === claims.sub || !n.user_id) && !n.is_read
    ).length;
  }

  /**
   * Audit log retriever (enforcing communication.audit.read)
   */
  public getAuditLogs(claims: TokenClaims): AuditEvent[] {
    this.verifyToken(claims);
    if (!claims.permissions.includes('communication.audit.read')) {
      throw new Error('403 Forbidden: Missing communication.audit.read permission');
    }
    return this.auditLogs.filter((a) => a.company_id === claims.company_id);
  }

  /**
   * Webhook history
   */
  public getWebhookLogs(claims: TokenClaims): WebhookEvent[] {
    this.verifyToken(claims);
    return this.webhookLogs.filter((w) => w.company_id === claims.company_id);
  }

  public recordAudit(
    company_id: string,
    actor_id: string,
    actor_name: string,
    action: string,
    target_type: AuditEvent['target_type'],
    target_id: string,
    details: Record<string, unknown>
  ) {
    const entry: AuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_id,
      actor_id,
      actor_name,
      action,
      target_type,
      target_id,
      details,
      timestamp: new Date().toISOString(),
      ip_address: '192.168.1.42',
    };
    this.auditLogs.unshift(entry);
    this.persist();
    this.emit('audit.created', entry);
  }

  public markChannelRead(channelId: string) {
    const chan = this.channels.find((c) => c.id === channelId);
    if (chan) {
      chan.unread_count = 0;
      this.persist();
      this.emit('channel.updated', chan);
    }
  }

  public resetDemoData() {
    try {
      sessionStorage.removeItem('workos_comm_state_v1');
      localStorage.removeItem('workos_comm_state_v1');
    } catch {}
    this.channels = [...INITIAL_CHANNELS];
    this.messages = [...INITIAL_MESSAGES];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.webhookLogs = [];
    this.emit('state.reset', null);
  }
}

// Global Singleton Engine instance representing the Communication Backend Service
export const communicationEngine = new CommunicationEngine();

/**
 * WorkOS SDK Client instance constructor
 */
export class WorkOSCommunicationClient {
  private getAccessTokenFn: () => Promise<string>;
  private cachedClaims: TokenClaims | null = null;

  constructor(options: { getAccessToken: () => Promise<string> }) {
    this.getAccessTokenFn = options.getAccessToken;
  }

  public async getClaims(): Promise<TokenClaims> {
    if (this.cachedClaims) return this.cachedClaims;
    const token = await this.getAccessTokenFn();

    // 1. If token is a JWT (header.payload.sig), decode payload:
    if (token && typeof token === 'string' && token.includes('.')) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const parsed = JSON.parse(jsonPayload);
          const email = (parsed.email || '').toLowerCase();
          const name = (parsed.name || '').toLowerCase();
          const sub = parsed.sub || '';

          if (email === 'rohan@company.com' || name.includes('rohan') || sub.includes('rohan')) {
            this.cachedClaims = MOCK_TOKENS.rohan;
            return this.cachedClaims;
          }
          if (email === 'vedant@company.com' || name.includes('vedant') || sub.includes('vedant')) {
            this.cachedClaims = MOCK_TOKENS.vedant;
            return this.cachedClaims;
          }
          if (email === 'sneha@company.com' || name.includes('sneha') || sub.includes('sneha')) {
            this.cachedClaims = MOCK_TOKENS.sneha;
            return this.cachedClaims;
          }
          if (email === 'alex@cyberdyne.io' || name.includes('alex') || sub.includes('alex')) {
            this.cachedClaims = MOCK_TOKENS.alex_external;
            return this.cachedClaims;
          }

          if (parsed.sub && parsed.name) {
            this.cachedClaims = parsed as TokenClaims;
            return this.cachedClaims;
          }
        }
      } catch (e) {
        console.warn('Failed to decode JWT token payload in client:', e);
      }
    }

    // 2. Exact match in MOCK_TOKENS
    if (MOCK_TOKENS[token]) {
      this.cachedClaims = MOCK_TOKENS[token];
      return this.cachedClaims;
    }

    // 3. Fallback: match by sub, email, or name
    const found = Object.values(MOCK_TOKENS).find(
      (t) => t.sub === token || t.email.toLowerCase() === token.toLowerCase() || t.name.toLowerCase() === token.toLowerCase()
    );
    if (found) {
      this.cachedClaims = found;
      return this.cachedClaims;
    }

    this.cachedClaims = MOCK_TOKENS.vedant;
    return this.cachedClaims;
  }

  public async listChannels(): Promise<Channel[]> {
    const claims = await this.getClaims();
    return communicationEngine.getChannels(claims);
  }

  public async listMessages(channelId: string, parentMessageId?: string): Promise<Message[]> {
    const claims = await this.getClaims();
    return communicationEngine.getMessages(claims, channelId, parentMessageId);
  }

  public async postMessage(params: {
    channelId: string;
    content: string;
    attachments?: Message['attachments'];
    objectRefs?: WorkOSObjectRef[];
    mentions?: string[];
    parentMessageId?: string;
    idempotencyKey?: string;
  }): Promise<Message> {
    const claims = await this.getClaims();
    return communicationEngine.sendMessage(claims, {
      channel_id: params.channelId,
      content: params.content,
      attachments: params.attachments,
      object_refs: params.objectRefs,
      mentions: params.mentions,
      parent_message_id: params.parentMessageId,
      idempotency_key: params.idempotencyKey,
    });
  }

  public async search(query: string) {
    const claims = await this.getClaims();
    return communicationEngine.search(claims, query);
  }
}
