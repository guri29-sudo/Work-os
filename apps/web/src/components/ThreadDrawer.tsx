import React, { useState, useRef, useEffect } from 'react';
import { X, Send, CornerDownRight, Smile, Paperclip, CheckCheck, ArrowLeft } from 'lucide-react';
import { Message, TokenClaims } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';

interface ThreadDrawerProps {
  claims: TokenClaims;
  parentMessage: Message;
  channelId: string;
  onClose: () => void;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  claims,
  parentMessage,
  channelId,
  onClose,
}) => {
  const [replies, setReplies] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const fetchReplies = () => {
    try {
      const msgs = communicationEngine.getMessages(claims, channelId, parentMessage.id);
      setReplies(msgs);
    } catch (err) {
      console.error('Failed to load thread replies', err);
    }
  };

  useEffect(() => {
    fetchReplies();
    const unsub = communicationEngine.subscribe('message.created', (newMsg: Message) => {
      if (newMsg.parent_message_id === parentMessage.id) {
        setReplies((prev) => [...prev, newMsg]);
      }
    });
    return () => unsub();
  }, [parentMessage.id, channelId]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const handleSendReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      communicationEngine.sendMessage(claims, {
        channel_id: channelId,
        content: replyText.trim(),
        parent_message_id: parentMessage.id,
        idempotency_key: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });
      setReplyText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 md:static w-full md:w-96 border-l border-slate-200/90 bg-white flex flex-col h-full shrink-0 shadow-2xl md:shadow-lg z-50 md:z-20 animate-slideIn">
      {/* Thread Header */}
      <div className="h-16 px-4 sm:px-5 border-b border-blue-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 -ml-2 rounded-xl text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition"
            aria-label="Back to conversation"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <CornerDownRight className="w-4 h-4 text-blue-600 hidden md:inline" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Thread</h3>
          <span className="text-xs text-blue-600 font-mono font-semibold">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition"
          aria-label="Close thread"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent Anchor Message */}
      <div className="p-4 bg-blue-50/50 border-b border-blue-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0a1a36] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {parentMessage.sender_initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 truncate">
                {parentMessage.sender_name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(parentMessage.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">
              {parentMessage.content}
            </p>
          </div>
        </div>
      </div>

      {/* Replies Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {replies.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            No replies in this thread yet. Send a reply below.
          </div>
        )}

        {replies.map((reply) => (
          <div key={reply.id} className="flex items-start gap-3 group">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              {reply.sender_initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-slate-900">{reply.sender_name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(reply.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {reply.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply Composer */}
      <div className="p-3 sm:p-4 border-t border-blue-100 bg-white sticky bottom-0 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:pb-3">
        <form onSubmit={handleSendReply} className="relative">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
            className="w-full pl-3 pr-12 py-3 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={!replyText.trim() || isSubmitting}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition shadow-2xs flex items-center justify-center"
            aria-label="Send reply"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
