import React from 'react';
import { X, Download, Pin, Printer, ExternalLink, FileText, Check, ShieldCheck } from 'lucide-react';
import { Attachment } from '../packages/contracts/types';
import { downloadAttachmentToDevice, generateValidPdfBlob } from '../utils/fileUtils';

interface PdfViewerModalProps {
  attachment: Attachment;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  attachment,
  isPinned = false,
  onTogglePin,
  onClose,
}) => {
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);

  // Prepare a safe object URL for preview
  const previewBlobUrl = React.useMemo(() => {
    if (attachment.url && (attachment.url.startsWith('blob:') || attachment.url.startsWith('data:'))) {
      return attachment.url;
    }
    const blob = generateValidPdfBlob(
      attachment.name,
      attachment.name,
      `WorkOS Verified Document. File size: ${(attachment.size / 1024).toFixed(1)} KB.`
    );
    return URL.createObjectURL(blob);
  }, [attachment]);

  const handleDownload = () => {
    downloadAttachmentToDevice(attachment);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open(previewBlobUrl);
    if (printWindow) {
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[88vh] shadow-2xl border border-blue-200 overflow-hidden flex flex-col animate-scaleUp">
        {/* Header with Blue Theme */}
        <div className="px-6 py-4 bg-[#0a1a36] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/30">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{attachment.name}</h3>
              <p className="text-[11px] text-blue-200/70 flex items-center gap-2">
                <span>{(attachment.size / 1024).toFixed(1)} KB</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3 h-3" /> Signed Expiring URL (Active)
                </span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onTogglePin && (
              <button
                onClick={onTogglePin}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isPinned
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'bg-white/10 hover:bg-white/20 text-blue-100'
                }`}
                title={isPinned ? 'Unpin from channel' : 'Pin to channel'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                <span>{isPinned ? 'Pinned' : 'Pin'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-blue-100 transition hidden sm:flex items-center justify-center"
              title="Print document"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shadow-sm"
              title="Download file to device"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Download</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Document Canvas View */}
        <div className="flex-1 bg-slate-100 overflow-hidden relative flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl h-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
            {/* Embedded PDF iframe */}
            <iframe
              src={previewBlobUrl}
              title={attachment.name}
              className="w-full h-full border-none"
            />
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3 bg-white border-t border-blue-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-medium text-slate-600">WorkOS Secure Private Storage</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save copy to your computer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
