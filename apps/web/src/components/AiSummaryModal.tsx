import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  ListTodo,
  HelpCircle,
  Users,
  MessageSquareQuote,
  ShieldAlert,
} from 'lucide-react';
import { SummaryData, GenerateSummaryResponse } from '../packages/contracts/types';

interface AiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationName: string;
  fromFormatted: string;
  toFormatted: string;
  summaryResponse: GenerateSummaryResponse | null;
  isLoading: boolean;
  loadingCount?: number;
  onCancelLoading?: () => void;
  error: string | null;
  onRetry: () => void;
  onRegenerate: () => void;
  hasNewMessagesSinceSummary?: boolean;
}

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({
  isOpen,
  onClose,
  conversationName,
  fromFormatted,
  toFormatted,
  summaryResponse,
  isLoading,
  loadingCount = 0,
  onCancelLoading,
  error,
  onRetry,
  onRegenerate,
  hasNewMessagesSinceSummary = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    discussion: true,
    decisions: true,
    pending: true,
    action_items: true,
    participants: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard accessibility: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap inside modal
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const summary = summaryResponse?.summary;
  const isEmpty = summaryResponse?.empty;

  const handleCopy = async () => {
    if (!summary) return;
    const textParts: string[] = [
      `# AI Summary: ${conversationName} (${fromFormatted} - ${toFormatted})`,
      `\n## Overview\n${summary.overview}`,
    ];

    if (summary.discussion_points?.length) {
      textParts.push(`\n## Key Discussion Points\n${summary.discussion_points.map((p) => `- ${p}`).join('\n')}`);
    }
    if (summary.decisions?.length) {
      textParts.push(
        `\n## Decisions\n${summary.decisions
          .map((d) => `- ${d.decision}${d.by ? ` (by ${d.by})` : ''}`)
          .join('\n')}`
      );
    }
    if (summary.action_items?.length) {
      textParts.push(
        `\n## Action Items\n${summary.action_items
          .map(
            (a) =>
              `- [ ] ${a.task}${a.assignee ? ` [@${a.assignee}]` : ''}${a.due ? ` (due: ${a.due})` : ''}`
          )
          .join('\n')}`
      );
    }
    if (summary.pending?.length) {
      textParts.push(`\n## Pending / Open Questions\n${summary.pending.map((p) => `- ${p}`).join('\n')}`);
    }
    if (summary.participants?.length) {
      textParts.push(`\n## Participants\n${summary.participants.join(', ')}`);
    }

    try {
      await navigator.clipboard.writeText(textParts.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] bg-[#0c0c12] border border-[#26262c] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col text-white overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#26262c] flex items-center justify-between shrink-0 bg-[#121218]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#4f3fd1]/20 border border-[#4f3fd1]/40 flex items-center justify-center shrink-0 text-[#8b7dff] shadow-sm shadow-[#4f3fd1]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="summary-modal-title" className="text-base font-bold text-white tracking-tight">
                  AI Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4f3fd1]/20 text-[#cfc9ff] border border-[#4f3fd1]/30 truncate">
                  {conversationName}
                </span>
              </div>
              <p className="text-xs text-[#8a8a93] truncate">
                Range: {fromFormatted} to {toFormatted}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8a8a93] hover:text-white hover:bg-white/10 transition"
            aria-label="Close summary modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time New Message Warning Banner */}
        {hasNewMessagesSinceSummary && !isLoading && (
          <div className="px-4 py-2.5 bg-[#4f3fd1]/15 border-b border-[#4f3fd1]/30 flex items-center justify-between text-xs text-[#d6d0ff]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#8b7dff] shrink-0" />
              <span>New messages arrived in this conversation since this summary.</span>
            </div>
            <button
              onClick={onRegenerate}
              className="px-2.5 py-1 rounded-lg bg-[#4f3fd1] hover:bg-[#5d4de0] text-white font-semibold text-xs transition"
            >
              Regenerate
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#4f3fd1]/30 border-t-[#8b7dff] animate-spin" />
                <Sparkles className="w-6 h-6 text-[#8b7dff]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Summarizing {loadingCount > 0 ? `${loadingCount} messages` : 'conversation'}...
                </p>
                <p className="text-xs text-[#8a8a93]">
                  Analyzing topics, decisions, and action items with AI
                </p>
              </div>
              {onCancelLoading && (
                <button
                  type="button"
                  onClick={onCancelLoading}
                  className="mt-2 px-3 py-1.5 rounded-xl border border-[#2e2e35] text-xs font-semibold text-[#a5a5ad] hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {!isLoading && error && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-white">Unable to generate summary</p>
                <p className="text-xs text-red-300/80">{error}</p>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 px-4 py-2 rounded-xl bg-[#4f3fd1] hover:bg-[#5d4de0] text-white text-xs font-semibold flex items-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && isEmpty && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#1b1b20] border border-[#2e2e35] flex items-center justify-center text-[#8a8a93]">
                <MessageSquareQuote className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">No messages in this date range</p>
                <p className="text-xs text-[#8a8a93]">
                  Try expanding the date range to include active conversation history.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && summary && (
            <div className="space-y-3">
              {summaryResponse.was_condensed && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    This date range contained a large volume of messages and was condensed using multi-stage analysis.
                  </span>
                </div>
              )}

              {/* 1. Overview */}
              <div className="rounded-xl border border-[#26262c] bg-[#14141a] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('overview')}
                  aria-expanded={openSections.overview}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
                    <MessageSquareQuote className="w-4 h-4 text-[#8b7dff]" />
                    <span>Overview</span>
                  </div>
                  {openSections.overview ? (
                    <ChevronDown className="w-4 h-4 text-[#8a8a93]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#8a8a93]" />
                  )}
                </button>
                {openSections.overview && (
                  <div className="px-4 pb-3.5 pt-1 text-sm text-[#d4d4dc] leading-relaxed border-t border-[#26262c]/60">
                    {summary.overview}
                  </div>
                )}
              </div>

              {/* 2. Key Discussion Points */}
              {summary.discussion_points && summary.discussion_points.length > 0 && (
                <div className="rounded-xl border border-[#26262c] bg-[#14141a] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('discussion')}
                    aria-expanded={openSections.discussion}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
                      <ListTodo className="w-4 h-4 text-[#8b7dff]" />
                      <span>Key Discussion Points ({summary.discussion_points.length})</span>
                    </div>
                    {openSections.discussion ? (
                      <ChevronDown className="w-4 h-4 text-[#8a8a93]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8a8a93]" />
                    )}
                  </button>
                  {openSections.discussion && (
                    <div className="px-4 pb-3.5 pt-2 border-t border-[#26262c]/60 space-y-2">
                      {summary.discussion_points.map((pt, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-[#d4d4dc]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8b7dff] mt-2 shrink-0" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Decisions */}
              {summary.decisions && summary.decisions.length > 0 && (
                <div className="rounded-xl border border-[#26262c] bg-[#14141a] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('decisions')}
                    aria-expanded={openSections.decisions}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Important Decisions ({summary.decisions.length})</span>
                    </div>
                    {openSections.decisions ? (
                      <ChevronDown className="w-4 h-4 text-[#8a8a93]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8a8a93]" />
                    )}
                  </button>
                  {openSections.decisions && (
                    <div className="px-4 pb-3.5 pt-2 border-t border-[#26262c]/60 space-y-2.5">
                      {summary.decisions.map((dec, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-[#1b1b23] border border-[#2b2b35] flex items-start justify-between gap-3"
                        >
                          <span className="text-sm text-[#e1e1e8] font-medium leading-snug">
                            {dec.decision}
                          </span>
                          {dec.by && (
                            <span className="px-2 py-0.5 rounded-md bg-[#4f3fd1]/20 text-[#cfc9ff] text-[11px] font-semibold border border-[#4f3fd1]/30 shrink-0">
                              by {dec.by}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Action Items */}
              {summary.action_items && summary.action_items.length > 0 && (
                <div className="rounded-xl border border-[#26262c] bg-[#14141a] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('action_items')}
                    aria-expanded={openSections.action_items}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
                      <ListTodo className="w-4 h-4 text-[#8b7dff]" />
                      <span>Action Items ({summary.action_items.length})</span>
                    </div>
                    {openSections.action_items ? (
                      <ChevronDown className="w-4 h-4 text-[#8a8a93]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8a8a93]" />
                    )}
                  </button>
                  {openSections.action_items && (
                    <div className="px-4 pb-3.5 pt-2 border-t border-[#26262c]/60 space-y-2.5">
                      {summary.action_items.map((item, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-[#1b1b23] border border-[#2b2b35] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-4 h-4 rounded border border-[#4f3fd1] flex items-center justify-center shrink-0 mt-0.5">
                              <span className="w-2 h-2 rounded-xs bg-[#4f3fd1]" />
                            </span>
                            <span className="text-sm text-[#e1e1e8] leading-snug">{item.task}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-6 sm:ml-0 shrink-0">
                            {item.assignee && (
                              <span className="px-2 py-0.5 rounded-md bg-[#4f3fd1]/20 text-[#cfc9ff] text-[11px] font-semibold border border-[#4f3fd1]/30">
                                @{item.assignee}
                              </span>
                            )}
                            {item.due && (
                              <span className="flex items-center gap-1 text-[11px] text-[#8a8a93] bg-[#22222b] px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-[#8b7dff]" />
                                {item.due}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Pending Tasks / Open Questions */}
              {summary.pending && summary.pending.length > 0 && (
                <div className="rounded-xl border border-[#26262c] bg-[#14141a] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('pending')}
                    aria-expanded={openSections.pending}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                      <span>Pending Tasks & Questions ({summary.pending.length})</span>
                    </div>
                    {openSections.pending ? (
                      <ChevronDown className="w-4 h-4 text-[#8a8a93]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8a8a93]" />
                    )}
                  </button>
                  {openSections.pending && (
                    <div className="px-4 pb-3.5 pt-2 border-t border-[#26262c]/60 space-y-2">
                      {summary.pending.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-[#d4d4dc]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 6. Participants */}
              {summary.participants && summary.participants.length > 0 && (
                <div className="rounded-xl border border-[#26262c] bg-[#14141a] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('participants')}
                    aria-expanded={openSections.participants}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
                      <Users className="w-4 h-4 text-[#8b7dff]" />
                      <span>Participants ({summary.participants.length})</span>
                    </div>
                    {openSections.participants ? (
                      <ChevronDown className="w-4 h-4 text-[#8a8a93]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8a8a93]" />
                    )}
                  </button>
                  {openSections.participants && (
                    <div className="px-4 pb-3.5 pt-2 border-t border-[#26262c]/60 flex flex-wrap gap-1.5">
                      {summary.participants.map((name, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-full bg-[#1e1e28] border border-[#2e2e3d] text-xs font-semibold text-[#d0cdff]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#26262c] bg-[#121218] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-[#8a8a93]">
            {summaryResponse?.cached ? (
              <span className="inline-flex items-center gap-1 text-[#8b7dff] font-medium">
                <Clock className="w-3.5 h-3.5" />
                Cached from earlier
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Fresh generation
              </span>
            )}
            <span>•</span>
            <span className="text-[10px] text-[#6f6f78]">AI-generated; verify key items.</span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            {summary && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl border border-[#2e2e35] text-xs font-semibold text-[#a5a5ad] hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={isLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-[#4f3fd1] hover:bg-[#5d4de0] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#4f3fd1]/30 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

