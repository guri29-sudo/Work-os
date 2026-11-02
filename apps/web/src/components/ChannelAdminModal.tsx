import React, { useState } from 'react';
import { X, Users, UserPlus, UserMinus, Archive, Hash, Lock, ShieldAlert, Check } from 'lucide-react';
import { Channel, TokenClaims, User } from '../packages/contracts/types';
import { SYNTHETIC_USERS } from '../packages/test-fixtures/fixtures';
import { communicationEngine } from '../packages/sdk/client';

interface ChannelAdminModalProps {
  claims: TokenClaims;
  channel: Channel;
  onClose: () => void;
  onChannelUpdated: (updated: Channel) => void;
}

export const ChannelAdminModal: React.FC<ChannelAdminModalProps> = ({
  claims,
  channel,
  onClose,
  onChannelUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [selectedNewMember, setSelectedNewMember] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canManageChannel = claims.permissions.includes('communication.channel.manage');
  const canManageMembers = claims.permissions.includes('communication.member.manage');

  // Company users not yet in this channel
  const availableUsers = Object.values(SYNTHETIC_USERS).filter(
    (u) => u.company_id === claims.company_id && !channel.member_ids.includes(u.id)
  );

  const handleAddMember = () => {
    if (!selectedNewMember) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = communicationEngine.updateChannelMembers(
        claims,
        channel.id,
        'add',
        selectedNewMember
      );
      setSelectedNewMember('');
      setSuccessMsg('Member added successfully.');
      onChannelUpdated(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = (memberId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = communicationEngine.updateChannelMembers(
        claims,
        channel.id,
        'remove',
        memberId
      );
      setSuccessMsg('Member removed.');
      onChannelUpdated(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove member');
    }
  };

  const handleToggleArchive = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = communicationEngine.archiveChannel(claims, channel.id);
      setSuccessMsg(updated.is_archived ? 'Channel archived.' : 'Channel unarchived.');
      onChannelUpdated(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update channel archive state');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-5 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 border border-blue-100">
              {channel.type === 'private' ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">#{channel.name}</h3>
              <p className="text-xs text-slate-500">Channel Administration & RBAC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-blue-100 px-6 gap-6 text-xs font-semibold bg-blue-50/20">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'members'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-blue-900'
            }`}
          >
            Members ({channel.member_ids.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-blue-900'
            }`}
          >
            Settings & Archive
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Add member control */}
              {canManageMembers ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedNewMember}
                    onChange={(e) => setSelectedNewMember(e.target.value)}
                    className="flex-1 px-3 py-2 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Select team member to add...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role_title})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedNewMember}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  You have view-only access for channel members (requires `communication.member.manage`).
                </div>
              )}

              {/* Members List */}
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {channel.member_ids.map((mId) => {
                  const user = Object.values(SYNTHETIC_USERS).find((u) => u.id === mId);
                  const isCreator = channel.created_by === mId;

                  return (
                    <div
                      key={mId}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                          {user?.initials || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {user?.name || mId}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {user?.role_title || 'Workspace User'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCreator && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Creator
                          </span>
                        )}
                        {canManageMembers && !isCreator && (
                          <button
                            onClick={() => handleRemoveMember(mId)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Remove member"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Channel Topic
                </label>
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {channel.topic || 'No topic configured'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Channel Description
                </label>
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {channel.description || 'No description'}
                </div>
              </div>

              {/* Archive channel control */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Archive Channel</h4>
                  <p className="text-[11px] text-slate-500">
                    Archived channels are read-only and preserved for compliance.
                  </p>
                </div>
                {canManageChannel ? (
                  <button
                    onClick={handleToggleArchive}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      channel.is_archived
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {channel.is_archived ? 'Unarchive' : 'Archive'}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Permission required</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
