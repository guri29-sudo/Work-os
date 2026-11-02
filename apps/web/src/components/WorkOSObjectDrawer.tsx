import React from 'react';
import { X, FolderKanban, CheckSquare, Building2, Receipt, ExternalLink, Calendar, User, Clock, ArrowRight } from 'lucide-react';
import { WorkOSObjectRef } from '../packages/contracts/types';

interface WorkOSObjectDrawerProps {
  object: WorkOSObjectRef;
  onClose: () => void;
  onRequestCreateTask?: () => void;
}

export const WorkOSObjectDrawer: React.FC<WorkOSObjectDrawerProps> = ({
  object,
  onClose,
  onRequestCreateTask,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-end z-50">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-slideIn">
        {/* Header */}
        <div>
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                {object.type === 'project' && <FolderKanban className="w-4 h-4" />}
                {object.type === 'task' && <CheckSquare className="w-4 h-4" />}
                {object.type === 'customer' && <Building2 className="w-4 h-4" />}
                {object.type === 'invoice' && <Receipt className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  WorkOS Host Integration · {object.type.toUpperCase()}
                </span>
                <h3 className="text-base font-bold text-slate-900">{object.id}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">
                {object.title}
              </h2>
              {object.subtitle && (
                <p className="text-xs text-slate-500">{object.subtitle}</p>
              )}
            </div>

            {/* Contract Notice */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <span className="font-bold text-slate-900 block">
                Integration Contract: Opaque Object Reference
              </span>
              <p className="text-slate-600 leading-relaxed">
                The communication database only stores the object ID (<code className="font-mono text-slate-900">{object.id}</code>) and type (<code className="font-mono text-slate-900">{object.type}</code>). This preview is rendered live by the WorkOS host container via the <code className="font-mono text-indigo-700">onOpenObject</code> callback.
              </p>
            </div>

            {/* Detailed Properties Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Status
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {object.status || 'Active'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Owner
                </span>
                <span className="font-medium text-slate-900">Vedant Kulkarni</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Target Delivery
                </span>
                <span className="font-mono text-slate-900">2026-11-15</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Close Drawer
          </button>
          <a
            href="#workos-host-view"
            onClick={(e) => {
              e.preventDefault();
              alert(`Simulated opening WorkOS host record: ${object.id}`);
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>Open in WorkOS</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
