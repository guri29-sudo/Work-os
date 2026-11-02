import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Hash,
  Lock,
  Plus,
  Circle,
} from 'lucide-react';
import { Channel, TokenClaims } from '../packages/contracts/types';

interface MessagesListViewProps {
  claims: TokenClaims;
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onNewMessage: () => void;
}

export const MessagesListView: React.FC<MessagesListViewProps> = ({
  claims,
  channels,
  activeChannelId,
  onSelectChannel,
  onNewMessage,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'dms' | 'channels'>('all');

  // Filter channels based on tab and search
  const filtered = channels.filter((c) => {
    if (tab === 'dms' && c.type !== 'direct') return false;
    if (tab === 'channels' && c.type === 'direct') return false;
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.last_message && c.last_message.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg-app)] overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-main)]">Messages</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Conversations & Direct Messages</p>
          </div>
        </div>

        <button
          onClick={onNewMessage}
          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition active:scale-95"
          aria-label="New Message"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Message</span>
        </button>
      </div>

      {/* Search and Tabs */}
      <div className="p-4 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-blue-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-10 pr-4 py-2 bg-blue-50/40 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl text-xs text-[var(--color-text-main)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              tab === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTab('dms')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              tab === 'dms'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Direct Messages
          </button>
          <button
            onClick={() => setTab('channels')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              tab === 'channels'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Channels
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)] pb-28 md:pb-6">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--color-text-muted)]">
            No conversations found. Start a new conversation with the button above!
          </div>
        ) : (
          filtered.map((chan) => {
            const isDirect = chan.type === 'direct';
            const initials = isDirect
              ? chan.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : chan.name.slice(0, 2).toUpperCase();
            const unread = chan.unread_count || 0;
            const isSelected = chan.id === activeChannelId;

            return (
              <button
                key={chan.id}
                onClick={() => onSelectChannel(chan.id)}
                className={`w-full p-4 flex items-center gap-3.5 hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition text-left group ${
                  isSelected ? 'bg-blue-50/80 dark:bg-slate-800/90' : ''
                }`}
                aria-label={`Open conversation ${chan.name}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shadow-2xs ${
                      isDirect
                        ? 'bg-blue-600 text-white'
                        : chan.type === 'private'
                        ? 'bg-[#0a1a36] text-white'
                        : 'bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {isDirect ? (
                      initials
                    ) : chan.type === 'private' ? (
                      <Lock className="w-5 h-5 text-blue-300" />
                    ) : (
                      <Hash className="w-5 h-5" />
                    )}
                  </div>
                  {unread > 0 ? (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 animate-pulse" />
                  ) : isDirect ? (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  ) : null}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-[var(--color-text-main)] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {isDirect ? chan.name : `#${chan.name}`}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono shrink-0 ml-2">
                      {chan.last_message_at || 'Recently'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[80%]">
                      {chan.last_message || chan.description || 'No messages yet'}
                    </p>
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

