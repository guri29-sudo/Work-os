import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Channel, TokenClaims } from '../packages/contracts/types';

interface MessagesListViewProps {
  claims: TokenClaims;
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onNewMessage: () => void;
}

const AVATAR_COLORS = ['#4f3fd1', '#c93a6e', '#2f7d6d', '#b9731f', '#2d6fd6', '#7a3fc4'];

export function avatarColor(seed: string, selected = false): string {
  if (selected) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const MessagesListView: React.FC<MessagesListViewProps> = ({
  channels,
  activeChannelId,
  onSelectChannel,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = channels.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.last_message && c.last_message.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full w-full px-3.5 pt-3.5 pb-3">
      {/* Search */}
      <div className="relative shrink-0">
        <Search className="w-[18px] h-[18px] text-[#8a8a93] absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Search for Anything"
          aria-label="Search conversations"
          className="w-full h-[45px] pl-11 pr-4 bg-[#2a2a2f] rounded-full text-[14px] text-white placeholder-[#85858e] outline-none focus:ring-1 focus:ring-[#4f3fd1]"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-0.5 -mx-1 px-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#85858e]">No conversations found.</div>
        ) : (
          filtered.map((chan) => {
            const isDirect = chan.type === 'direct';
            const label = isDirect ? chan.name : `#${chan.name}`;
            const initial = chan.name.trim().charAt(0).toUpperCase();
            const isSelected = chan.id === activeChannelId;
            const unread = chan.unread_count || 0;

            return (
              <button
                key={chan.id}
                onClick={() => onSelectChannel(chan.id)}
                aria-label={`Open conversation ${chan.name}`}
                className={`w-full h-16 px-2 flex items-center gap-3 rounded-2xl text-left transition-colors ${
                  isSelected ? 'bg-[#2c2c31]' : 'hover:bg-[#232328]'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-[15px]"
                  style={{ backgroundColor: avatarColor(chan.id, isSelected) }}
                >
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[16px] font-semibold text-white truncate leading-[20px]">{label}</span>
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#4f3fd1] text-white text-[10px] font-bold flex items-center justify-center">
                        {unread}
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-[#8d8d96] truncate leading-[18px]">
                    {chan.last_message || chan.description || 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
