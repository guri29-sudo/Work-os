import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  AtSign,
  FolderKanban,
  Hash,
  Lock,
  MoreVertical,
  MessageSquare,
  CheckCheck,
  Clock,
  Sparkles,
  Settings,
  Users,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  CheckSquare,
  Building2,
  Receipt,
  FileText,
  AlertCircle,
  X,
  CornerDownRight,
  Pin,
  Download,
  Eye,
  UploadCloud,
  Check,
  ArrowLeft,
  ChevronDown,
  Copy,
  Forward,
} from 'lucide-react';
import {
  Attachment,
  Channel,
  Message,
  TokenClaims,
  User,
  WorkOSObjectRef,
  GenerateSummaryResponse,
} from '../packages/contracts/types';
import {
  SYNTHETIC_OBJECTS,
  SYNTHETIC_USERS,
} from '../packages/test-fixtures/fixtures';
import { communicationEngine, SUMMARY_UNREAD_THRESHOLD } from '../packages/sdk/client';
import { downloadAttachmentToDevice, processDeviceUpload } from '../utils/fileUtils';
import { PdfViewerModal } from './PdfViewerModal';
import { AiSummaryModal } from './AiSummaryModal';
import { DateRangePicker } from './DateRangePicker';

interface ConversationViewProps {
  claims: TokenClaims;
  channel: Channel;
  channels: Channel[];
  messages: Message[];
  hasUnreadChannels?: boolean;
  onBack?: () => void;
  onOpenChannelList?: () => void;
  onOpenThread: (message: Message) => void;
  onOpenObject: (obj: WorkOSObjectRef) => void;
  onCreateTask: (context: { messageId: string; content: string; authorName: string }) => void;
  onOpenChannelAdmin: (channel: Channel) => void;
}

function formatDaySeparator(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  claims,
  channel,
  channels,
  messages,
  hasUnreadChannels = false,
  onBack,
  onOpenChannelList,
  onOpenThread,
  onOpenObject,
  onCreateTask,
  onOpenChannelAdmin,
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerPanel, setComposerPanel] = useState<null | 'menu' | 'mention' | 'object' | 'emoji'>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [openMessageMenu, setOpenMessageMenu] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardDestination, setForwardDestination] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<WorkOSObjectRef[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // AI Summary States
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryResponse, setSummaryResponse] = useState<GenerateSummaryResponse | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryLoadingCount, setSummaryLoadingCount] = useState(0);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryFromFormatted, setSummaryFromFormatted] = useState('');
  const [summaryToFormatted, setSummaryToFormatted] = useState('');
  const [summaryFromUtc, setSummaryFromUtc] = useState('');
  const [summaryToUtc, setSummaryToUtc] = useState('');
  const [hasNewMessagesSinceSummary, setHasNewMessagesSinceSummary] = useState(false);
  const lastSummaryMessageCountRef = useRef(0);
  const summaryAbortControllerRef = useRef<AbortController | null>(null);

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute unread count for current conversation (messages by others, non-deleted, after last read marker)
  const unreadCount = communicationEngine.getUnreadCountForConversation(claims, channel.id);
  const hasSummaryHighlight = unreadCount >= SUMMARY_UNREAD_THRESHOLD;

  // Realtime notification when new messages arrive while summary modal is open
  useEffect(() => {
    if (showSummaryModal && !isSummaryLoading && lastSummaryMessageCountRef.current > 0) {
      if (messages.length > lastSummaryMessageCountRef.current) {
        setHasNewMessagesSinceSummary(true);
      }
    }
  }, [messages.length, showSummaryModal, isSummaryLoading]);

  // Default From Date: oldest unread message if any, otherwise 7 days ago
  const defaultFromDateStr = React.useMemo(() => {
    const oldestUnread = communicationEngine.getOldestUnreadMessageDate(claims, channel.id);
    if (oldestUnread) return oldestUnread;
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toLocaleDateString('en-CA');
  }, [claims, channel.id, messages.length]);

  const defaultToDateStr = React.useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  const handleOpenDateRangePicker = () => {
    setComposerPanel(null);
    setShowDateRangePicker(true);
  };

  const executeGenerateSummary = async (fromUtc: string, toUtc: string, regenerate = false) => {
    if (summaryAbortControllerRef.current) {
      summaryAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    summaryAbortControllerRef.current = controller;

    setIsSummaryLoading(true);
    setSummaryError(null);
    setHasNewMessagesSinceSummary(false);

    // Calculate message count for the loading indicator
    const fromD = new Date(fromUtc);
    const toD = new Date(toUtc);
    const inRange = messages.filter((m) => {
      if (m.channel_id !== channel.id || m.is_deleted) return false;
      const d = new Date(m.created_at);
      return d >= fromD && d <= toD;
    });
    setSummaryLoadingCount(inRange.length);

    try {
      const res = await communicationEngine.generateSummary(
        claims,
        channel.id,
        fromUtc,
        toUtc,
        regenerate,
        controller.signal
      );
      setSummaryResponse(res);
      lastSummaryMessageCountRef.current = messages.length;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setSummaryError(err.message || 'Failed to generate AI summary');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleStartSummary = (
    fromUtc: string,
    toUtc: string,
    fromFmt: string,
    toFmt: string
  ) => {
    setShowDateRangePicker(false);
    setSummaryFromUtc(fromUtc);
    setSummaryToUtc(toUtc);
    setSummaryFromFormatted(fromFmt);
    setSummaryToFormatted(toFmt);
    setShowSummaryModal(true);
    executeGenerateSummary(fromUtc, toUtc, false);
  };

  const handleRegenerateSummary = () => {
    if (!summaryFromUtc || !summaryToUtc) return;
    executeGenerateSummary(summaryFromUtc, summaryToUtc, true);
  };

  const handleCancelSummary = () => {
    if (summaryAbortControllerRef.current) {
      summaryAbortControllerRef.current.abort();
    }
    setIsSummaryLoading(false);
  };

  // PDF Preview & Pinned Drawer State
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [viewingAttachmentPinned, setViewingAttachmentPinned] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const channelInitials = channel.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const canManageChannel = claims.permissions.includes('communication.channel.manage');
  const canSend = claims.permissions.includes('communication.message.send');
  const canModerate = claims.permissions.includes('communication.message.moderate');
  const isAnnouncementRestricted =
    channel.announcement_only &&
    !claims.permissions.includes('communication.announcement.publish');

  // Filter pinned messages in this channel
  const pinnedMessages = messages.filter((m) => m.is_pinned);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && selectedAttachments.length === 0 && selectedObjects.length === 0) {
      return;
    }

    if (isAnnouncementRestricted) {
      setErrorBanner('This channel is restricted to announcements published by authorized leads.');
      return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      const mentionedIds: string[] = [];
      Object.values(SYNTHETIC_USERS).forEach((u) => {
        if (content.includes(`@${u.name}`) || content.includes(`@${u.name.split(' ')[0]}`)) {
          mentionedIds.push(u.id);
        }
      });

      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      communicationEngine.sendMessage(claims, {
        channel_id: channel.id,
        content: content.trim(),
        attachments: selectedAttachments,
        object_refs: selectedObjects,
        mentions: mentionedIds,
        idempotency_key: idempotencyKey,
      });

      setContent('');
      setSelectedAttachments([]);
      setSelectedObjects([]);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Real Device File Upload Handler
  const handleDeviceFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (let i = 0; i < files.length; i++) {
        const processed = await processDeviceUpload(files[i]);
        setSelectedAttachments((prev) => [...prev, processed]);
      }
      setSuccessBanner(`Uploaded ${files.length} file(s) from your device.`);
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to read device file');
    } finally {
      e.target.value = '';
    }
  };

  // Drag and Drop files from device
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    try {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const processed = await processDeviceUpload(e.dataTransfer.files[i]);
        setSelectedAttachments((prev) => [...prev, processed]);
      }
      setSuccessBanner(`Uploaded ${e.dataTransfer.files.length} file(s) from device.`);
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner('Failed to process dropped files');
    }
  };

  const insertMention = (user: User) => {
    setContent((prev) => `${prev}@${user.name} `);
    setComposerPanel(null);
    textareaRef.current?.focus();
  };

  const insertObject = (obj: WorkOSObjectRef) => {
    if (!selectedObjects.some((o) => o.id === obj.id)) {
      setSelectedObjects((prev) => [...prev, obj]);
    }
    setComposerPanel(null);
    textareaRef.current?.focus();
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    try {
      communicationEngine.toggleReaction(claims, messageId, emoji);
      setShowEmojiPicker(null);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleTogglePin = (messageId: string) => {
    try {
      const updated = communicationEngine.togglePinMessage(claims, messageId);
      if (updated.is_pinned) {
        setSuccessBanner('Message and attached PDF pinned to channel.');
      } else {
        setSuccessBanner('Message unpinned.');
      }
      setTimeout(() => setSuccessBanner(null), 2500);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editingContent.trim()) return;
    try {
      communicationEngine.editMessage(claims, messageId, editingContent.trim());
      setEditingMessageId(null);
      setEditingContent('');
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleDelete = (messageId: string) => {
    if (!window.confirm('Delete this message? This action cannot be undone.')) return;
    try {
      communicationEngine.deleteMessage(claims, messageId);
      setOpenMessageMenu(null);
      setSuccessBanner('Message deleted.');
      setTimeout(() => setSuccessBanner(null), 2500);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleCopyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setOpenMessageMenu(null);
      setSuccessBanner('Message copied to clipboard.');
      setTimeout(() => setSuccessBanner(null), 2500);
    } catch {
      setErrorBanner('Clipboard access was blocked by your browser.');
    }
  };

  const handleForwardMessage = () => {
    if (!forwardingMessage || !forwardDestination) return;
    try {
      communicationEngine.forwardMessage(claims, forwardingMessage.id, forwardDestination);
      setForwardingMessage(null);
      setForwardDestination('');
      setOpenMessageMenu(null);
      setSuccessBanner('Message forwarded.');
      setTimeout(() => setSuccessBanner(null), 2500);
    } catch (err: any) {
      setErrorBanner(err.message || 'Unable to forward this message.');
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const canSubmit =
    !isSubmitting &&
    !isAnnouncementRestricted &&
    (content.trim() || selectedAttachments.length > 0 || selectedObjects.length > 0);

  const subtitle =
    channel.type === 'direct' ? 'Active Now' : channel.topic || `${channel.member_ids.length} members`;

  const iconBtn =
    'p-1.5 rounded-lg text-[#8a8a93] hover:text-white hover:bg-white/10 transition';
  const popover =
    'absolute right-0 bottom-full mb-3 bg-[#1b1b20] border border-[#2e2e35] rounded-2xl shadow-2xl p-2 z-30';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col h-full min-h-0 bg-[#03030a] text-white overflow-hidden relative ${
        isDraggingOver ? 'ring-2 ring-[#4f3fd1] ring-inset' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
        onChange={handleDeviceFilesSelected}
        className="hidden"
      />

      {isDraggingOver && (
        <div className="absolute inset-0 bg-[#4f3fd1]/10 flex items-center justify-center z-40 border-2 border-dashed border-[#4f3fd1] pointer-events-none">
          <div className="bg-[#1b1b20] px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-white font-semibold text-sm">
            <UploadCloud className="w-6 h-6 text-[#8b7dff]" />
            <span>Drop PDF or documents from your device to upload</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="group/header mx-1.5 h-[70px] px-3 border-b border-[#26262c] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden min-h-[44px] min-w-[44px] -ml-2 p-2 rounded-xl text-[#8a8a93] hover:text-white hover:bg-white/10 flex items-center justify-center transition shrink-0"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-[15px]"
            style={{ backgroundColor: '#4f3fd1' }}
          >
            {channel.type === 'direct' ? channel.name.charAt(0).toUpperCase() : '#'}
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] leading-[20px] font-semibold text-white truncate">
              {channel.type === 'direct' ? channel.name : `#${channel.name}`}
            </h2>
            <p className="text-[16px] leading-[20px] text-[#6f6f78] truncate">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/header:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={() => setShowPinnedDrawer(!showPinnedDrawer)}
              className={`${iconBtn} relative`}
              title="Toggle pinned PDFs and messages"
              aria-label="Pinned messages"
            >
              <Pin className={`w-4 h-4 ${pinnedMessages.length > 0 ? 'fill-current text-[#8b7dff]' : ''}`} />
              {pinnedMessages.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#4f3fd1] text-white text-[9px] font-bold flex items-center justify-center">
                  {pinnedMessages.length}
                </span>
              )}
            </button>
            {channel.linked_object && (
              <button
                onClick={() => onOpenObject(channel.linked_object!)}
                className={iconBtn}
                title={`Open ${channel.linked_object.id}: ${channel.linked_object.title}`}
                aria-label="Open linked record"
              >
                <FolderKanban className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onOpenChannelAdmin(channel)}
              className={iconBtn}
              title="Channel settings and members"
              aria-label="Channel settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <button onClick={onBack} className={`${iconBtn} p-2`} aria-label="Close conversation">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pinned drawer */}
      {showPinnedDrawer && (
        <div className="mx-1.5 bg-[#0d0d14] border-b border-[#26262c] px-4 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#cfc9ff]">
              <Pin className="w-3.5 h-3.5 fill-current text-[#8b7dff]" />
              <span>Pinned ({pinnedMessages.length})</span>
            </div>
            <button onClick={() => setShowPinnedDrawer(false)} className="text-[#8a8a93] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {pinnedMessages.length === 0 ? (
            <p className="text-xs text-[#8a8a93]">Nothing pinned yet. Hover a message and click the pin icon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {pinnedMessages.map((pMsg) => (
                <div
                  key={pMsg.id}
                  className="bg-[#17171b] p-2.5 rounded-xl flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{pMsg.sender_name}</div>
                    <div className="text-xs text-[#a5a5ad] truncate">{pMsg.content}</div>
                    {pMsg.attachments && pMsg.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-[#8b7dff] mt-0.5">
                        <FileText className="w-3 h-3" />
                        <span className="truncate">{pMsg.attachments[0].name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {pMsg.attachments && pMsg.attachments.length > 0 && (
                      <button
                        onClick={() => {
                          setViewingAttachment(pMsg.attachments[0]);
                          setViewingAttachmentPinned(true);
                        }}
                        className="p-1 text-[#8b7dff] hover:bg-white/10 rounded"
                        title="View PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleTogglePin(pMsg.id)}
                      className="p-1 text-[#8a8a93] hover:text-rose-400 rounded"
                      title="Unpin"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {errorBanner && (
        <div className="mx-1.5 mt-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successBanner && (
        <div className="mx-1.5 mt-2 rounded-xl bg-[#4f3fd1]/15 border border-[#4f3fd1]/40 px-4 py-2 flex items-center justify-between text-xs text-[#d9d4ff]">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#8b7dff] shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-[#8b7dff] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message feed */}
      <div className="flex-1 min-h-0 overflow-y-auto px-[12px] py-6">
        {messages.length === 0 && (
          <div className="py-16 text-center text-[#6f6f78]">
            <MessageSquare className="w-9 h-9 mx-auto mb-2 opacity-60" />
            <p className="text-sm">No messages yet. Send the first message below.</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isSender = msg.sender_id === claims.sub;
          const isDeleted = msg.is_deleted;
          const isEditing = editingMessageId === msg.id;
          const isNewDay =
            idx === 0 ||
            new Date(msg.created_at).toDateString() !==
              new Date(messages[idx - 1].created_at).toDateString();
          const parentMsg = msg.parent_message_id
            ? messages.find((m) => m.id === msg.parent_message_id)
            : null;
          const avatarBg = isSender ? '#c93a6e' : '#4f3fd1';

          const avatar = (
            <div
              className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-[15px]"
              style={{ backgroundColor: avatarBg }}
              title={msg.sender_name}
            >
              {msg.sender_name.charAt(0).toUpperCase()}
            </div>
          );

          return (
            <React.Fragment key={msg.id}>
              {isNewDay && (
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 bg-[#17171b] text-[#8a8a93] rounded-full text-[11px] font-semibold">
                    {formatDaySeparator(msg.created_at)}
                  </span>
                </div>
              )}

              <div className={`group relative mt-[22px] first:mt-0 ${isSender ? 'text-right' : 'text-left'}`}>
                {/* Author row */}
                <div className={`flex items-center gap-3 ${isSender ? 'justify-end' : 'justify-start'}`}>
                  {!isSender && avatar}
                  {isSender && (
                    <span className="text-[14px] text-[#8a8a93] tabular-nums">{formatTime(msg.created_at)}</span>
                  )}
                  <span
                    className={`text-[15px] font-semibold ${isSender ? 'text-white' : 'text-[#dcd7ff]'}`}
                  >
                    {msg.sender_name}
                  </span>
                  {!isSender && (
                    <span className="text-[14px] text-[#8a8a93] tabular-nums">{formatTime(msg.created_at)}</span>
                  )}
                  {isSender && avatar}
                </div>

                {/* Body */}
                <div
                  className={`mt-[14px] px-[2px] flex flex-col ${isSender ? 'items-end' : 'items-start'} ${
                    msg.is_pinned ? 'border-l-2 border-amber-400/70 pl-2' : ''
                  }`}
                >
                  {msg.parent_message_id && (
                    <div
                      onClick={() => onOpenThread(parentMsg || msg)}
                      className="cursor-pointer border-l-2 border-[#4f3fd1] pl-2 py-0.5 mb-2 text-xs truncate rounded bg-white/5 text-[#b8b3e6] max-w-[70%] text-left"
                    >
                      <div className="font-semibold text-[10px]">
                        Replying to {parentMsg ? parentMsg.sender_name : 'thread'}
                      </div>
                      <div className="truncate text-[11px]">{parentMsg ? parentMsg.content : 'View thread reply'}</div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-2 w-full max-w-[70%]">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full p-2 bg-[#17171b] text-white rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#4f3fd1]"
                        rows={2}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => handleSaveEdit(msg.id)}
                          className="px-2.5 py-1 bg-[#4f3fd1] text-white text-xs font-semibold rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-2.5 py-1 bg-white/10 text-white text-xs rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[15px] leading-[22px] text-white whitespace-pre-wrap break-words">
                      {isDeleted ? (
                        <span className="italic text-[#6f6f78]">This message was deleted.</span>
                      ) : (
                        msg.content.split(/(@[a-zA-Z0-9\s]+)/g).map((part, i) =>
                          part.startsWith('@') ? (
                            <span key={i} className="font-semibold text-[#a99cff]">
                              {part}
                            </span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )
                      )}
                      {msg.is_edited && !isDeleted && (
                        <span className="ml-1.5 text-[11px] text-[#6f6f78]">(edited)</span>
                      )}
                    </div>
                  )}

                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5 w-full max-w-[420px]">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2 rounded-xl flex items-center justify-between gap-2 bg-[#17171b] text-left"
                        >
                          <div
                            onClick={() => {
                              setViewingAttachment(att);
                              setViewingAttachmentPinned(!!msg.is_pinned);
                            }}
                            className="flex items-center gap-2 min-w-0 cursor-pointer"
                          >
                            <FileText className="w-4 h-4 shrink-0 text-[#8b7dff]" />
                            <span className="text-xs font-semibold truncate">{att.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-[#8a8a93]">
                            <button
                              onClick={() => {
                                setViewingAttachment(att);
                                setViewingAttachmentPinned(!!msg.is_pinned);
                              }}
                              className="p-1 hover:text-white hover:bg-white/10 rounded"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => downloadAttachmentToDevice(att)}
                              className="p-1 hover:text-white hover:bg-white/10 rounded"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.object_refs && msg.object_refs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.object_refs.map((obj) => (
                        <button
                          key={obj.id}
                          onClick={() => onOpenObject(obj)}
                          className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 bg-[#17171b] text-[#cfc9ff] hover:bg-[#222228]"
                        >
                          <FolderKanban className="w-3 h-3" />
                          <span className="font-semibold">{obj.id}:</span>
                          <span className="truncate max-w-[120px]">{obj.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.reactions.map((rx) => {
                        const hasReacted = rx.user_ids.includes(claims.sub);
                        return (
                          <button
                            key={rx.emoji}
                            onClick={() => handleToggleReaction(msg.id, rx.emoji)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                              hasReacted
                                ? 'bg-[#4f3fd1]/25 border-[#4f3fd1] text-[#d9d4ff]'
                                : 'bg-[#17171b] border-[#2a2a30] text-[#b5b5bd]'
                            }`}
                          >
                            <span>{rx.emoji}</span>
                            <span className="font-mono text-[10px]">{rx.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {msg.thread_count > 0 && (
                    <button
                      onClick={() => onOpenThread(msg)}
                      className="mt-2 text-xs font-semibold text-[#a99cff] hover:underline flex items-center gap-1"
                    >
                      <CornerDownRight className="w-3 h-3" />
                      <span>
                        {msg.thread_count} {msg.thread_count === 1 ? 'reply' : 'replies'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Message actions */}
                {!isDeleted && (
                  <div
                    className={`opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity absolute top-[44px] ${
                      isSender ? 'left-0' : 'right-0'
                    } bg-[#1b1b20] border border-[#2e2e35] rounded-xl shadow-lg flex items-center p-0.5 z-20`}
                  >
                    <button type="button" onClick={() => handleTogglePin(msg.id)} className={iconBtn} title={msg.is_pinned ? 'Unpin message' : 'Pin message'}>
                      <Pin className={`w-3.5 h-3.5 ${msg.is_pinned ? 'text-violet-300' : ''}`} />
                    </button>
                    <button type="button" onClick={() => onOpenThread(msg)} className={iconBtn} title="Reply in thread">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                      className={iconBtn}
                      title="React"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenMessageMenu(openMessageMenu === msg.id ? null : msg.id)}
                      className={iconBtn}
                      title="More message actions"
                      aria-label="More message actions"
                      aria-expanded={openMessageMenu === msg.id}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {openMessageMenu === msg.id && (
                      <div className={`absolute top-full mt-1 ${isSender ? 'left-0' : 'right-0'} min-w-44 rounded-xl border border-[#34343d] bg-[#202027] p-1.5 shadow-2xl z-40`}>
                        <button type="button" onClick={() => handleCopyMessage(msg)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#e5e5eb] hover:bg-white/10">
                          <Copy className="h-3.5 w-3.5" /> Copy message
                        </button>
                        <button type="button" onClick={() => { setForwardingMessage(msg); setForwardDestination(''); setOpenMessageMenu(null); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#e5e5eb] hover:bg-white/10">
                          <Forward className="h-3.5 w-3.5" /> Forward
                        </button>
                        {(isSender || canModerate) && (
                          <button type="button" onClick={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); setOpenMessageMenu(null); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#e5e5eb] hover:bg-white/10">
                            <Edit2 className="h-3.5 w-3.5" /> Edit message
                          </button>
                        )}
                        {(isSender || canModerate) && (
                          <button type="button" onClick={() => handleDelete(msg.id)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10">
                            <Trash2 className="h-3.5 w-3.5" /> Delete message
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {showEmojiPicker === msg.id && (
                  <div
                    className={`absolute ${isSender ? 'left-0' : 'right-0'} top-[4px] bg-[#1b1b20] border border-[#2e2e35] rounded-xl shadow-lg p-1 flex gap-1 z-30`}
                  >
                    {['👍', '❤️', '🚀', '🎉', '🔥', '👀', '✅'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleToggleReaction(msg.id, em)}
                        className="p-1 hover:bg-white/10 rounded text-sm transition"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {forwardingMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="forward-message-title">
          <div className="w-full max-w-md rounded-2xl border border-[#34343d] bg-[#1b1b20] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="forward-message-title" className="text-base font-semibold text-white">Forward message</h2>
              <button type="button" onClick={() => setForwardingMessage(null)} className={iconBtn} aria-label="Close forward dialog"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 line-clamp-3 rounded-xl bg-white/5 p-3 text-sm text-[#c9c9d2]">{forwardingMessage.content}</p>
            <label htmlFor="forward-destination" className="mb-1.5 block text-xs font-medium text-[#b8b8c2]">Choose a conversation</label>
            <select id="forward-destination" value={forwardDestination} onChange={(event) => setForwardDestination(event.target.value)} className="w-full rounded-xl border border-[#3a3a44] bg-[#121216] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400">
              <option value="">Select destination</option>
              {channels.filter((item) => item.id !== channel.id && !item.is_archived).map((item) => (
                <option key={item.id} value={item.id}>{item.type === 'direct' ? item.name : `# ${item.name}`}</option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setForwardingMessage(null)} className="rounded-xl px-4 py-2 text-sm text-[#b8b8c2] hover:bg-white/5">Cancel</button>
              <button type="button" onClick={handleForwardMessage} disabled={!forwardDestination} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><Forward className="h-4 w-4" /> Forward</button>
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="px-1.5 pb-1.5 pt-2 shrink-0">
        {(selectedAttachments.length > 0 || selectedObjects.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {selectedObjects.map((obj) => (
              <span
                key={obj.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#17171b] text-[#d9d4ff] text-xs font-medium"
              >
                <FolderKanban className="w-3.5 h-3.5 text-[#8b7dff]" />
                <span>
                  {obj.id}: {obj.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedObjects((prev) => prev.filter((o) => o.id !== obj.id))}
                  className="hover:text-white"
                  aria-label="Remove record"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#17171b] text-white text-xs font-medium"
              >
                <FileText className="w-3.5 h-3.5 text-[#8b7dff]" />
                <span>{att.name}</span>
                <span className="text-[10px] text-[#8a8a93] font-mono">({(att.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={() => setSelectedAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  className="hover:text-rose-400"
                  aria-label="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="relative min-h-[52px] bg-[#17171b] rounded-[26px] flex items-center pl-5 pr-3 gap-2 focus-within:ring-1 focus-within:ring-[#4f3fd1]/70"
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canSend || isAnnouncementRestricted}
            placeholder={
              isAnnouncementRestricted ? 'Only authorized announcement authors may post here' : 'Write your Message'
            }
            aria-label="Write your message"
            rows={1}
            className="flex-1 bg-transparent resize-none text-[16px] leading-[24px] py-[14px] text-white placeholder-[#6b6b73] outline-none max-h-32 [field-sizing:content]"
          />

          {canSubmit && (
            <button
              type="submit"
              className="w-8 h-8 rounded-full bg-[#4f3fd1] hover:bg-[#5d4de0] text-white flex items-center justify-center shrink-0 transition"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setComposerPanel(composerPanel ? null : 'menu')}
            className="relative w-8 h-8 rounded-full flex items-center justify-center text-[#a5a5ad] hover:text-white hover:bg-white/10 shrink-0 transition"
            aria-label="More actions"
            aria-expanded={!!composerPanel}
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.75} />
            {hasSummaryHighlight && (
              <span
                title={`${unreadCount} unread messages`}
                className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#8b7dff] ring-2 ring-[#17171b] shadow-sm shadow-[#4f3fd1]"
              />
            )}
          </button>

          {composerPanel === 'menu' && (
            isMobile ? (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-fadeIn"
                  onClick={() => setComposerPanel(null)}
                />
                <div className="fixed inset-x-0 bottom-0 z-50 bg-[#17171d] border-t border-[#2e2e38] rounded-t-2xl p-4 shadow-2xl animate-slideUp text-white space-y-1">
                  <div className="w-10 h-1 bg-[#2e2e38] rounded-full mx-auto mb-3" />
                  {[
                    { label: 'Attach file', icon: Paperclip, run: () => { fileInputRef.current?.click(); setComposerPanel(null); } },
                    { label: 'Mention colleague', icon: AtSign, run: () => setComposerPanel('mention') },
                    { label: 'Link WorkOS record', icon: FolderKanban, run: () => setComposerPanel('object') },
                    { label: 'Insert emoji', icon: Smile, run: () => setComposerPanel('emoji') },
                  ].map(({ label, icon: Icon, run }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={run}
                      className="w-full min-h-[48px] px-3 py-2.5 rounded-xl text-left text-sm text-white hover:bg-white/10 flex items-center gap-3 transition"
                    >
                      <Icon className="w-5 h-5 text-[#8b7dff] shrink-0" />
                      <span className="font-medium">{label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleOpenDateRangePicker}
                    className={`w-full min-h-[48px] px-3 py-2.5 rounded-xl text-left text-sm flex items-center justify-between gap-3 transition ${
                      hasSummaryHighlight
                        ? 'bg-[#4f3fd1]/20 text-[#cfc9ff] border border-[#4f3fd1]/40 shadow-sm shadow-[#4f3fd1]/30 hover:bg-[#4f3fd1]/30'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-[#8b7dff] shrink-0" />
                      <span className="font-medium">Summarize using AI</span>
                    </div>
                    {hasSummaryHighlight && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#4f3fd1] text-white shadow-xs">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className={`${popover} w-60`}>
                {[
                  { label: 'Attach file', icon: Paperclip, run: () => { fileInputRef.current?.click(); setComposerPanel(null); } },
                  { label: 'Mention colleague', icon: AtSign, run: () => setComposerPanel('mention') },
                  { label: 'Link WorkOS record', icon: FolderKanban, run: () => setComposerPanel('object') },
                  { label: 'Insert emoji', icon: Smile, run: () => setComposerPanel('emoji') },
                ].map(({ label, icon: Icon, run }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={run}
                    className="w-full px-3 py-2 rounded-xl text-left text-sm text-white hover:bg-white/10 flex items-center gap-3 transition"
                  >
                    <Icon className="w-4 h-4 text-[#8b7dff]" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleOpenDateRangePicker}
                  className={`w-full px-3 py-2 rounded-xl text-left text-sm flex items-center justify-between gap-3 transition ${
                    hasSummaryHighlight
                      ? 'bg-[#4f3fd1]/20 text-[#cfc9ff] border border-[#4f3fd1]/40 shadow-sm shadow-[#4f3fd1]/30 hover:bg-[#4f3fd1]/30'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-[#8b7dff]" />
                    <span>Summarize using AI</span>
                  </div>
                  {hasSummaryHighlight && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#4f3fd1] text-white shadow-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
            )
          )}

          {composerPanel === 'mention' && (
            <div className={`${popover} w-64`}>
              <div className="text-[11px] font-semibold text-[#8a8a93] uppercase tracking-wider px-2 py-1">
                Mention colleague
              </div>
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {Object.values(SYNTHETIC_USERS)
                  .filter((u) => u.company_id === claims.company_id)
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => insertMention(u)}
                      className="w-full px-2 py-1.5 rounded-xl text-left hover:bg-white/10 flex items-center gap-2 transition"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#4f3fd1] text-white font-semibold text-[10px] flex items-center justify-center">
                        {u.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{u.name}</div>
                        <div className="text-[10px] text-[#8a8a93] truncate">{u.role_title}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {composerPanel === 'object' && (
            <div className={`${popover} w-72`}>
              <div className="text-[11px] font-semibold text-[#8a8a93] uppercase tracking-wider px-2 py-1">
                Reference WorkOS record
              </div>
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {Object.values(SYNTHETIC_OBJECTS).map((obj) => (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => insertObject(obj)}
                    className="w-full px-2 py-1.5 rounded-xl text-left hover:bg-white/10 flex items-center gap-2 transition"
                  >
                    <div className="w-6 h-6 rounded bg-[#4f3fd1]/25 text-[#cfc9ff] flex items-center justify-center text-[9px] font-mono font-bold">
                      {obj.type === 'project' ? 'PRJ' : obj.type === 'task' ? 'TSK' : 'DOC'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {obj.id}: {obj.title}
                      </div>
                      <div className="text-[10px] text-[#8a8a93] truncate">{obj.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {composerPanel === 'emoji' && (
            <div className={`${popover} flex gap-1`}>
              {['👍', '❤️', '🚀', '🎉', '🔥', '👀', '💡', '✅'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setContent((prev) => `${prev} ${em} `);
                    setComposerPanel(null);
                    textareaRef.current?.focus();
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-base transition"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {viewingAttachment && (
        <PdfViewerModal
          attachment={viewingAttachment}
          isPinned={viewingAttachmentPinned}
          onTogglePin={() => {
            const parentMsg = messages.find((m) => m.attachments.some((a) => a.id === viewingAttachment.id));
            if (parentMsg) {
              handleTogglePin(parentMsg.id);
              setViewingAttachmentPinned(!viewingAttachmentPinned);
            }
          }}
          onClose={() => setViewingAttachment(null)}
        />
      )}

      {showDateRangePicker && (
        <DateRangePicker
          initialFromDate={defaultFromDateStr}
          initialToDate={defaultToDateStr}
          isMobile={isMobile}
          isSubmitting={isSummaryLoading}
          onGenerate={handleStartSummary}
          onClose={() => setShowDateRangePicker(false)}
        />
      )}

      <AiSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        conversationName={channel.type === 'direct' ? channel.name : `#${channel.name}`}
        fromFormatted={summaryFromFormatted}
        toFormatted={summaryToFormatted}
        summaryResponse={summaryResponse}
        isLoading={isSummaryLoading}
        loadingCount={summaryLoadingCount}
        onCancelLoading={handleCancelSummary}
        error={summaryError}
        onRetry={() => executeGenerateSummary(summaryFromUtc, summaryToUtc, false)}
        onRegenerate={handleRegenerateSummary}
        hasNewMessagesSinceSummary={hasNewMessagesSinceSummary}
      />
    </div>
  );
};
