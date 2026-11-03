import React, { useState, useEffect } from 'react';
import { X, Shield, ShieldAlert, Filter, RefreshCw } from 'lucide-react';
import { AuditEvent, TokenClaims } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';

interface AuditLogViewerProps {
  claims: TokenClaims;
  onClose: () => void;
}

function formatAuditLine(log: AuditEvent): string {
  const actor = log.actor_name || 'User';
  const details = (log.details || {}) as Record<string, any>;
  if (log.action === 'channel.created') {
    const chan = details.name ? `#${details.name}` : log.target_id;
    return `${actor} created ${chan}`;
  }
  if (log.action === 'announcement.published') {
    const chan = details.channel ? `#${details.channel}` : 'announcements';
    return `${actor} published an announcement in #${chan}`;
  }
  if (log.action.includes('tenant_access_rejected') || log.action.includes('rejected')) {
    return `${actor} unauthorized access attempt was blocked`;
  }
  if (log.action === 'channel.archived') {
    return `${actor} archived channel ${log.target_id}`;
  }
  if (log.action === 'member.added') {
    return `${actor} updated members in ${log.target_id}`;
  }
  return `${actor} ${log.action.replace('.', ' ')}`;
}

function formatAuditDate(iso: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ claims, onClose }) => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('all');

  const fetchLogs = () => {
    try {
      setErrorMsg(null);
      const auditData = communicationEngine.getAuditLogs(claims);
      setLogs(auditData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Permission denied to read audit records');
    }
  };

  useEffect(() => {
    fetchLogs();
    const unsub = communicationEngine.subscribe('audit.created', (entry: AuditEvent) => {
      if (entry.company_id === claims.company_id) {
        setLogs((prev) => [entry, ...prev]);
      }
    });
    return () => unsub();
  }, [claims]);

  const filteredLogs = logs.filter((log) => {
    if (filterAction === 'all') return true;
    if (filterAction === 'security') return log.action.startsWith('security.');
    if (filterAction === 'channel') return log.action.startsWith('channel.');
    if (filterAction === 'message') return log.action.startsWith('message.');
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-blue-100 overflow-hidden animate-scaleUp flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-blue-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Activity log for workspace modifications and administration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close audit log"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-blue-50 bg-blue-50/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600">Filter:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-white border border-blue-100 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none"
            >
              <option value="all">All Events ({logs.length})</option>
              <option value="security">Security</option>
              <option value="channel">Channels</option>
              <option value="message">Messages</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error / Unauthorized */}
        {errorMsg ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-rose-900">Access Restricted</h4>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMsg}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 divide-y divide-blue-50 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No audit entries recorded for this filter.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <span className="text-slate-800 font-medium">{formatAuditLine(log)}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] shrink-0 ml-4">
                    {formatAuditDate(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end text-xs shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
