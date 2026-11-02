import React from 'react';
import {
  MessageSquare,
  AtSign,
  FileText,
  Hash,
  FolderKanban,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  Sparkles,
  Pin,
} from 'lucide-react';
import { Channel, Message, TokenClaims, User } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';

interface HomeDashboardProps {
  claims: TokenClaims;
  channels: Channel[];
  totalUnread?: number;
  onSelectChannel: (channelId: string) => void;
  onOpenSearch: (filter?: string) => void;
  onOpenAuditLogs: () => void;
  onOpenNewMessage: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  claims,
  channels,
  totalUnread: propTotalUnread,
  onSelectChannel,
  onOpenSearch,
  onOpenAuditLogs,
  onOpenNewMessage,
}) => {
  const firstName = claims.name ? claims.name.split(' ')[0] : 'there';

  // Dynamic date and greeting
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Single source of truth for unread: passed prop or calculated from channels
  const unreadCount = propTotalUnread !== undefined
    ? propTotalUnread
    : channels.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const totalMentions = channels.filter((c) => (c.unread_count || 0) > 0 && c.type !== 'direct').length;

  // Recent files count from API (files shared in user's channels, last 7 days)
  const totalFiles = communicationEngine.getRecentFilesCount(claims, 7);

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-fadeIn overflow-y-auto">
      {/* Header Greeting Section (Blue Shade Theme) */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-blue-500 block mb-1">
          {dateStr}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text-main)] tracking-tight">
          {greeting}, {firstName}.
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Your workspace, in sync. Here's what's happening today.
        </p>
      </div>

      {/* Top 3 Stat Cards with Blue Accents */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Unread messages */}
        <div
          onClick={() => onSelectChannel('chan_engineering')}
          className="bg-[var(--color-bg-card)] rounded-2xl p-6 border border-[var(--color-border)] shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] group-hover:text-blue-700 transition">
              Unread messages
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--color-text-main)] tracking-tight font-mono tabular-nums">
            {unreadCount}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-2">Across your conversations</div>
        </div>

        {/* Mentions */}
        <div
          onClick={() => onSelectChannel('chan_engineering')}
          className="bg-[var(--color-bg-card)] rounded-2xl p-6 border border-[var(--color-border)] shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] group-hover:text-blue-700 transition">
              Mentions
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <AtSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--color-text-main)] tracking-tight font-mono tabular-nums">
            {totalMentions}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-2">You're part of the conversation</div>
        </div>

        {/* New files */}
        <div
          onClick={() => onOpenSearch('files')}
          className="bg-[var(--color-bg-card)] rounded-2xl p-6 border border-[var(--color-border)] shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] group-hover:text-blue-700 transition">
              New files
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--color-text-main)] tracking-tight font-mono tabular-nums">
            {totalFiles}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-2">Shared with your teams</div>
        </div>
      </div>

      {/* Main 2-Column Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Recent conversations & Latest activity */}
        <div className="lg:col-span-8 space-y-8">
          {/* Recent Conversations */}
          <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Recent conversations</h2>
              <button
                onClick={() => onOpenSearch('channels')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-blue-50">
              {channels.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No conversations yet. Start a new message!</div>
              ) : (
                channels
                  .filter(c => c.type !== 'direct')
                  .slice(0, 4)
                  .map((chan) => {
                    const initials = chan.name.split(/[-_ ]/).map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
                    return (
                      <div
                        key={chan.id}
                        onClick={() => onSelectChannel(chan.id)}
                        className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-blue-50/60 px-3 -mx-3 rounded-xl transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-900">
                              {chan.name}
                            </div>
                            {chan.last_message && (
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {chan.last_message}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {chan.last_message_at && (
                            <span className="text-xs text-slate-400 font-medium">{chan.last_message_at}</span>
                          )}
                          {(chan.unread_count || 0) > 0 && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                              {chan.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Latest Activity Section */}
          <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Latest activity</h2>
              {claims.permissions.includes('communication.audit.read') && (
                <button
                  onClick={onOpenAuditLogs}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                >
                  <span>Activity log</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div
                onClick={() => onSelectChannel('chan_engineering')}
                className="flex items-start gap-3 hover:bg-blue-50/60 p-2.5 -m-2 rounded-xl transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                  RS
                </div>
                <div className="text-xs">
                  <p className="text-slate-800 font-medium">
                    <strong className="text-slate-900">Rohan Deshmukh</strong> mentioned you in{' '}
                    <span className="text-blue-600 font-semibold">#engineering</span>.
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">12 minutes ago</span>
                </div>
              </div>

              <div
                onClick={() => onSelectChannel('chan_apollo')}
                className="flex items-start gap-3 hover:bg-blue-50/60 p-2.5 -m-2 rounded-xl transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                  SP
                </div>
                <div className="text-xs">
                  <p className="text-slate-800 font-medium">
                    <strong className="text-slate-900">Sneha Patil</strong> shared a file in{' '}
                    <span className="text-blue-600 font-semibold">Project Apollo</span>.
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">38 minutes ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Quick access & Your day */}
        <div className="lg:col-span-4 space-y-8">
          {/* Quick Access Card */}
          <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4">Quick access</h2>
            <div className="space-y-3">
              {channels
                .filter(c => c.type !== 'direct')
                .slice(0, 2)
                .map((chan) => (
                  <button
                    key={chan.id}
                    onClick={() => onSelectChannel(chan.id)}
                    className="w-full p-3 rounded-xl border border-blue-100/80 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{chan.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {chan.member_ids.length} members{(chan.unread_count || 0) > 0 ? ` · ${chan.unread_count} new` : ''}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>
                ))}

              <button
                onClick={() => onOpenSearch('files')}
                className="w-full p-3 rounded-xl border border-blue-100/80 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Shared files</div>
                    <div className="text-[11px] text-slate-500">Recently updated documents</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>
            </div>
          </div>

          {/* Your Day Schedule */}
          <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Your day</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                TODAY
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/60 transition">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center font-mono border border-blue-100">
                  10
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Engineering stand-up</div>
                  <div className="text-[11px] text-slate-500">10:30 AM · Team Engineering</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/60 transition">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center font-mono border border-blue-100">
                  04
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Project Apollo review</div>
                  <div className="text-[11px] text-slate-500">4:00 PM · Project Apollo</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quiet Footer Note */}
      <div className="text-center text-xs text-blue-400/80 pt-6">
        WorkOS Communication · Blue Theme
      </div>
    </div>
  );
};
