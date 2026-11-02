import React, { useState } from 'react';
import { X, Hash, Lock, FolderKanban, ShieldAlert, Plus } from 'lucide-react';
import { Channel, ChannelType, TokenClaims, WorkOSObjectRef } from '../packages/contracts/types';
import { SYNTHETIC_OBJECTS, SYNTHETIC_USERS } from '../packages/test-fixtures/fixtures';
import { communicationEngine } from '../packages/sdk/client';

interface NewChannelModalProps {
  claims: TokenClaims;
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
}

export const NewChannelModal: React.FC<NewChannelModalProps> = ({
  claims,
  onClose,
  onChannelCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChannelType>('public');
  const [topic, setTopic] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canCreatePublic = claims.permissions.includes('communication.channel.create');
  const canCreatePrivate = claims.permissions.includes('communication.private_channel.create');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg(null);

    try {
      const linkedObj = selectedObjectId ? SYNTHETIC_OBJECTS[selectedObjectId] : undefined;

      const created = communicationEngine.createChannel(claims, {
        name: name.trim(),
        description: description.trim(),
        type,
        topic: topic.trim(),
        linked_object: linkedObj,
      });

      onChannelCreated(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create channel');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
        <div className="px-6 py-5 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New Channel</h3>
              <p className="text-xs text-slate-500">Company-isolated workspace channel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-xs">
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. project-apollo-team"
                required
                className="w-full pl-8 pr-3 py-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Channel Type & Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('public')}
                disabled={!canCreatePublic}
                className={`p-3 rounded-xl border text-left transition ${
                  type === 'public'
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 text-blue-900'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${!canCreatePublic ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-0.5">
                  <Hash className="w-3.5 h-3.5 text-blue-600" />
                  <span>Public</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Visible to all members of {claims.company_id}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('private')}
                disabled={!canCreatePrivate}
                className={`p-3 rounded-xl border text-left transition ${
                  type === 'private'
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 text-blue-900'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${!canCreatePrivate ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-0.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Private</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  By invitation only ({canCreatePrivate ? 'Permitted' : 'Permission needed'})
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description / Topic
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full px-3 py-2 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Link WorkOS Business Record (Optional)
            </label>
            <select
              value={selectedObjectId}
              onChange={(e) => setSelectedObjectId(e.target.value)}
              className="w-full px-3 py-2 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition shadow-sm shadow-blue-500/25"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
