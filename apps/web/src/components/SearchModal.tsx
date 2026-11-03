import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Hash,
  FileText,
  Users,
  FolderKanban,
  ExternalLink,
} from 'lucide-react';
import { Channel, Message, TokenClaims, User, WorkOSObjectRef } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';
import { downloadAttachmentToDevice } from '../utils/fileUtils';

interface SearchModalProps {
  claims: TokenClaims;
  initialFilter?: string;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  onOpenObject: (obj: WorkOSObjectRef) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  claims,
  initialFilter = 'all',
  onClose,
  onSelectChannel,
  onOpenObject,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'channels' | 'files' | 'people'>('all');
  const [results, setResults] = useState<{
    messages: Message[];
    channels: Channel[];
    files: { name: string; channelName: string; size: number; url: string }[];
    people: User[];
  }>({ messages: [], channels: [], files: [], people: [] });

  useEffect(() => {
    if (!query.trim()) {
      setResults({ messages: [], channels: [], files: [], people: [] });
      return;
    }

    try {
      const res = communicationEngine.search(claims, query);
      setResults(res);
    } catch {
      // Search failed silently
    }
  }, [query, claims]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasQuery = Boolean(query.trim());

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-20 p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-blue-100 dark:border-slate-800 overflow-hidden animate-scaleUp">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-blue-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-500 shrink-0 ml-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, files, channels, people…"
            autoFocus
            className="w-full text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-blue-50 dark:border-slate-800 px-5 gap-4 text-xs font-semibold bg-blue-50/30 dark:bg-slate-800/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            All Results
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition ${
              activeTab === 'messages'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            Messages{hasQuery ? ` (${results.messages.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition ${
              activeTab === 'channels'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            Channels{hasQuery ? ` (${results.channels.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition ${
              activeTab === 'files'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            Files{hasQuery ? ` (${results.files.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition ${
              activeTab === 'people'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-blue-900 dark:hover:text-slate-200'
            }`}
          >
            People{hasQuery ? ` (${results.people.length})` : ''}
          </button>
        </div>

        {/* Results Area */}
        <div className="p-4 max-h-96 overflow-y-auto space-y-4">
          {!query.trim() ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Type to search across messages, channels, files, and people.
            </div>
          ) : results.messages.length === 0 &&
            results.channels.length === 0 &&
            results.files.length === 0 &&
            results.people.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No results found matching "{query}".
            </div>
          ) : (
            <>
              {/* People */}
              {(activeTab === 'all' || activeTab === 'people') && results.people.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">
                    People
                  </span>
                  <div className="space-y-1">
                    {results.people.map((person) => (
                      <div
                        key={person.id}
                        className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {person.initials}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>{person.name}</span>
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                                {person.role_title}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">{person.email}</div>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium">
                          {person.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels */}
              {(activeTab === 'all' || activeTab === 'channels') && results.channels.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">
                    Channels
                  </span>
                  <div className="space-y-1">
                    {results.channels.map((chan) => (
                      <button
                        key={chan.id}
                        onClick={() => {
                          onSelectChannel(chan.id);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition text-left group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Hash className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-200" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">#{chan.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">
                              {chan.description}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400">Jump →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {(activeTab === 'all' || activeTab === 'messages') && results.messages.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">
                    Messages
                  </span>
                  <div className="space-y-1">
                    {results.messages.map((msg) => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          onSelectChannel(msg.channel_id);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-start gap-3 transition text-left group"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {msg.sender_initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {msg.sender_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">{msg.content}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {(activeTab === 'all' || activeTab === 'files') && results.files.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-2">
                    Files & Attachments
                  </span>
                  <div className="space-y-1">
                    {results.files.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-rose-600" />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{f.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Shared in #{f.channelName} · {(f.size / 1024).toFixed(0)} KB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            downloadAttachmentToDevice({
                              id: `search_${idx}`,
                              name: f.name,
                              size: f.size,
                              mime_type: f.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
                              url: f.url,
                              expires_at: Date.now() + 3600000,
                            })
                          }
                          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-xl transition shadow-2xs"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
