import React, { useState } from 'react';
import { X, Search, MessageSquare, UserCheck, Plus } from 'lucide-react';
import { Channel, TokenClaims, User } from '../packages/contracts/types';
import { SYNTHETIC_USERS } from '../packages/test-fixtures/fixtures';
import { communicationEngine } from '../packages/sdk/client';

interface NewMessageModalProps {
  claims: TokenClaims;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  onOpenNewChannelModal: () => void;
}

export const NewMessageModal: React.FC<NewMessageModalProps> = ({
  claims,
  onClose,
  onSelectChannel,
  onOpenNewChannelModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Find users in current company excluding current user
  const companyUsers = Object.values(SYNTHETIC_USERS).filter(
    (u) => u.company_id === claims.company_id && u.id !== claims.sub
  );

  const filteredUsers = companyUsers.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartDM = (targetUser: User) => {
    // Check if DM channel already exists between these two
    const channels = communicationEngine.getChannels(claims);
    const existingDM = channels.find(
      (c) =>
        c.type === 'direct' &&
        c.member_ids.includes(claims.sub) &&
        c.member_ids.includes(targetUser.id)
    );

    if (existingDM) {
      onSelectChannel(existingDM.id);
      onClose();
      return;
    }

    // Create new direct conversation
    const newDM = communicationEngine.createChannel(claims, {
      name: targetUser.name,
      description: `Direct message with ${targetUser.name}`,
      type: 'direct',
      member_ids: [targetUser.id],
    });

    onSelectChannel(newDM.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
        <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">New Message</h3>
            <p className="text-xs text-slate-500">Start a direct conversation with a teammate</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search colleague by name or role..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="p-4 max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-50">
          {filteredUsers.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No matching colleagues found.
            </div>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleStartDM(u)}
                className="w-full p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {u.initials}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-slate-950">
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-500">{u.role_title}</div>
                  </div>
                </div>
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900" />
              </button>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Need a group channel instead?</span>
          <button
            onClick={() => {
              onClose();
              onOpenNewChannelModal();
            }}
            className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Channel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
