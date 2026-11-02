import React, { useState, useMemo } from 'react';
import {
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Eye,
  Search,
  Filter,
  FolderOpen,
} from 'lucide-react';
import { Channel, TokenClaims } from '../packages/contracts/types';
import { communicationEngine } from '../packages/sdk/client';
import { downloadAttachmentToDevice } from '../utils/fileUtils';
import { PdfViewerModal } from './PdfViewerModal';

interface FilesViewProps {
  claims: TokenClaims;
  channels: Channel[];
}

export const FilesView: React.FC<FilesViewProps> = ({ claims, channels }) => {
  const [selectedType, setSelectedType] = useState<'all' | 'pdf' | 'image' | 'document'>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingPdf, setViewingPdf] = useState<{ name: string; url: string } | null>(null);

  const allFiles = useMemo(() => {
    try {
      return communicationEngine.getAllFiles(claims);
    } catch {
      return [];
    }
  }, [claims]);

  const filteredFiles = useMemo(() => {
    return allFiles.filter((file) => {
      if (selectedType !== 'all' && file.type !== selectedType) return false;
      if (selectedChannel !== 'all' && file.channel_id !== selectedChannel) return false;
      if (searchQuery.trim() && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allFiles, selectedType, selectedChannel, searchQuery]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg-app)] overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-main)]">Files & Attachments</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              All documents, assets, and media shared in your channels
            </p>
          </div>
        </div>
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-slate-700">
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-blue-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by filename…"
              className="w-full pl-10 pr-4 py-2 bg-blue-50/40 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl text-xs text-[var(--color-text-main)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-1.5 overflow-x-auto">
            {(['all', 'pdf', 'image', 'document'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedType === t
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t === 'all' ? 'All Types' : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Channel Filter */}
          <div>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3 py-2 bg-blue-50/40 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl text-xs text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
            >
              <option value="all">All Channels & DMs</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === 'direct' ? c.name : `#${c.name}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Files Table / List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredFiles.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-text-muted)] space-y-3">
            <FolderOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold">No files match your filters</p>
            <p className="text-xs">Try selecting a different channel or file type.</p>
          </div>
        ) : (
          <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] shadow-xs divide-y divide-[var(--color-border)] overflow-hidden">
            {filteredFiles.map((f) => {
              const isPdf = f.type === 'pdf';
              const isImage = f.type === 'image';

              return (
                <div
                  key={f.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPdf
                          ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/40'
                          : isImage
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/40'
                          : 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/40'
                      }`}
                    >
                      {isPdf ? (
                        <FileText className="w-5 h-5" />
                      ) : isImage ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <File className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--color-text-main)] truncate max-w-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {f.name}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] flex flex-wrap items-center gap-2 mt-0.5">
                        <span>{formatSize(f.size)}</span>
                        <span>•</span>
                        <span>#{f.channel_name}</span>
                        <span>•</span>
                        <span>Uploaded by {f.uploader_name}</span>
                        <span>•</span>
                        <span>{formatDate(f.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isPdf && (
                      <button
                        onClick={() => setViewingPdf({ name: f.name, url: f.url })}
                        className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    )}
                    <button
                      onClick={() =>
                        downloadAttachmentToDevice({
                          id: f.id,
                          name: f.name,
                          size: f.size,
                          mime_type: isPdf
                            ? 'application/pdf'
                            : isImage
                            ? 'image/png'
                            : 'application/octet-stream',
                          url: f.url,
                          expires_at: Date.now() + 3600000,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF Viewer modal if previewing */}
      {viewingPdf && (
        <PdfViewerModal
          attachment={{
            id: 'pdf_preview',
            name: viewingPdf.name,
            size: 1024,
            mime_type: 'application/pdf',
            url: viewingPdf.url,
            expires_at: Date.now() + 3600000,
          }}
          onClose={() => setViewingPdf(null)}
        />
      )}
    </div>
  );
};

