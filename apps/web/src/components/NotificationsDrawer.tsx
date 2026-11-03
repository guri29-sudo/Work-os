import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  AtSign,
  MessageSquare,
  CornerDownRight,
  UserPlus,
  Hash,
} from 'lucide-react';
import { NotificationItem, TokenClaims } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';

interface NotificationsDrawerProps {
  claims: TokenClaims;
  onClose: () => void;
  onNavigate: (conversationId: string, messageId?: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  claims,
  onClose,
  onNavigate,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = () => {
    try {
      const list = communicationEngine.getNotifications(claims);
      setNotifications(list);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();

    const unsubCreated = communicationEngine.subscribe('notification.created', () => {
      loadNotifications();
    });
    const unsubUpdated = communicationEngine.subscribe('notification.updated', () => {
      loadNotifications();
    });
    const unsubAllRead = communicationEngine.subscribe('notification.all_read', () => {
      loadNotifications();
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubAllRead();
    };
  }, [claims]);

  const handleMarkAllRead = () => {
    try {
      communicationEngine.markAllNotificationsAsRead(claims);
      loadNotifications();
    } catch {}
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    try {
      if (!notif.is_read) {
        communicationEngine.markNotificationAsRead(claims, notif.id);
      }
    } catch {}
    onNavigate(notif.conversation_id, notif.message_id);
    onClose();
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full sm:max-w-md bg-[var(--color-bg-card)] h-full flex flex-col shadow-2xl border-l border-[var(--color-border)] animate-slideLeft">
        {/* Header */}
        <div className="h-16 px-5 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--color-text-main)]">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">Activity, mentions & invites</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
          {notifications.length === 0 ? (
            <div className="py-24 px-6 text-center text-[var(--color-text-muted)] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[var(--color-text-main)]">You're all caught up</p>
              <p className="text-xs">No pending notifications or mentions.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.is_read;

              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full p-4 flex items-start gap-3.5 hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition text-left group ${
                    isUnread ? 'bg-blue-50/30 dark:bg-slate-800/40' : ''
                  }`}
                >
                  {/* Actor Avatar with kind badge */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {notif.actor_initials || 'RD'}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center shadow-2xs border border-[var(--color-border)]">
                      {notif.kind === 'mention' ? (
                        <AtSign className="w-2.5 h-2.5 text-blue-600" />
                      ) : notif.kind === 'reply' ? (
                        <CornerDownRight className="w-2.5 h-2.5 text-cyan-600" />
                      ) : notif.kind === 'dm' ? (
                        <MessageSquare className="w-2.5 h-2.5 text-indigo-600" />
                      ) : (
                        <Hash className="w-2.5 h-2.5 text-emerald-600" />
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-[var(--color-text-main)] truncate">
                        {notif.actor_name}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono shrink-0">
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                      {notif.preview}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center mt-1" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

