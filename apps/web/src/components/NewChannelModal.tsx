import React, { useEffect, useMemo, useState } from 'react';
import { X, Hash, Lock, ShieldAlert, Plus } from 'lucide-react';
import { Channel, ChannelType, TokenClaims } from '../packages/contracts/types';
import { SYNTHETIC_OBJECTS, SYNTHETIC_USERS } from '../packages/test-fixtures/fixtures';
import { communicationEngine } from '../packages/sdk/client';

interface NewChannelModalProps {
  claims: TokenClaims;
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
  initialType?: 'public' | 'private';
}

export const NewChannelModal: React.FC<NewChannelModalProps> = ({
  claims,
  onClose,
  onChannelCreated,
  initialType = 'public',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChannelType>(initialType);
  const [memberQuery, setMemberQuery] = useState('');
  useEffect(() => setType(initialType), [initialType]);
  const availableMembers = useMemo(() => Object.values(SYNTHETIC_USERS).filter((user) => user.id !== claims.sub && `${user.name} ${user.email}`.toLowerCase().includes(memberQuery.toLowerCase())), [claims.sub, memberQuery]);
  const [topic, setTopic] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canCreatePublic = claims.permissions.includes('communication.channel.create');
  const canCreatePrivate = claims.permissions.includes('communication.private_channel.create');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg(null);
    if (type === 'private' && selectedMembers.length < 1) {
      setErrorMsg('Select at least one person to create a group conversation.');
      return;
    }

    try {
      const linkedObj = selectedObjectId ? SYNTHETIC_OBJECTS[selectedObjectId] : undefined;

      const created = communicationEngine.createChannel(claims, {
        name: name.trim(),
        description: description.trim(),
        type,
        member_ids: selectedMembers,
        topic: topic.trim(),
        linked_object: linkedObj,
      });

      onChannelCreated(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create channel');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[110]" role="dialog" aria-modal="true" aria-labelledby="create-channel-title">
      <div className="bg-[#17171e] text-white rounded-3xl max-w-lg w-full max-h-[92dvh] overflow-y-auto shadow-2xl border border-[#34343d] animate-scaleUp">
        <div className="px-5 sm:px-6 py-5 border-b border-[#303039] flex items-center justify-between sticky top-0 bg-[#17171e] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-200 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="create-channel-title" className="text-base font-bold text-white">{type === 'private' ? 'Create Group' : 'Create New Channel'}</h3>
              <p className="text-xs text-[#92919c]">{type === 'private' ? 'Create a private group conversation' : 'Create a workspace channel'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#92919c] hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-300" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#c9c8d1] mb-1.5">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-300 font-bold text-xs">
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. project-apollo-team"
                required
                className="w-full pl-8 pr-3 py-3 bg-[#0d0d12] border border-[#383842] rounded-xl text-sm text-white placeholder-[#777783] focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#c9c8d1] mb-1.5">
              Channel Type & Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('public')}
                disabled={!canCreatePublic}
                className={`p-3 rounded-xl border text-left transition ${
                  type === 'public'
                    ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/40 text-white'
                    : 'border-[#383842] hover:bg-white/5 text-white'
                } ${!canCreatePublic ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white mb-0.5">
                  <Hash className="w-3.5 h-3.5 text-violet-300" />
                  <span>Public</span>
                </div>
                <div className="text-[10px] text-[#92919c]">
                  Visible to all members of {claims.company_id}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('private')}
                disabled={!canCreatePrivate}
                className={`p-3 rounded-xl border text-left transition ${
                  type === 'private'
                    ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/40 text-white'
                    : 'border-[#383842] hover:bg-white/5 text-white'
                } ${!canCreatePrivate ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white mb-0.5">
                  <Lock className="w-3.5 h-3.5 text-violet-300" />
                  <span>Private</span>
                </div>
                <div className="text-[10px] text-[#92919c]">
                  Private group chat · invited members only ({canCreatePrivate ? 'Permitted' : 'Permission needed'})
                </div>
              </button>
            </div>
          </div>

          {type === 'private' && (
            <div>
              <label className="block text-xs font-semibold text-[#c9c8d1] mb-1.5">Add group members</label>
              <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search people" className="mb-2 w-full rounded-xl border border-[#383842] bg-[#0d0d12] px-3 py-2.5 text-sm text-white placeholder-[#777783] outline-none focus:border-violet-500" />
              <div className="max-h-44 overflow-y-auto rounded-xl border border-[#383842] p-2 space-y-1">
                {availableMembers.map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-xs text-[#d8d7df] hover:bg-white/5">
                    <input type="checkbox" className="accent-violet-500" checked={selectedMembers.includes(user.id)} onChange={(event) => setSelectedMembers((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 font-semibold text-violet-200">{user.name.split(' ').map((part) => part[0]).join('').slice(0,2)}</span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold text-white">{user.name}</span><span className="block truncate text-[#85848e]">{user.email}</span></span>
                    {selectedMembers.includes(user.id) && <span className="text-violet-300">Selected</span>}
                  </label>
                ))}
                {availableMembers.length === 0 && <p className="p-3 text-center text-xs text-[#85848e]">No matching people found.</p>}
              </div>
              <p className="mt-1 text-[10px] text-[#92919c]">Choose at least one member. The group creator is automatically included as an administrator.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#c9c8d1] mb-1.5">
              Description / Topic
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full px-3 py-3 bg-[#0d0d12] border border-[#383842] rounded-xl text-sm text-white placeholder-[#777783] focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#c9c8d1] mb-1.5">
              Link WorkOS Business Record (Optional)
            </label>
            <select
              value={selectedObjectId}
              onChange={(e) => setSelectedObjectId(e.target.value)}
              className="w-full px-3 py-3 bg-[#0d0d12] border border-[#383842] rounded-xl text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">No linked object</option>
              {Object.values(SYNTHETIC_OBJECTS).map((obj) => (
                <option key={obj.id} value={obj.id}>
                  [{obj.id}] {obj.title} ({obj.type})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-[#aaa9b2] hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition shadow-sm shadow-violet-500/20"
            >
              {type === 'private' ? 'Create Group' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
