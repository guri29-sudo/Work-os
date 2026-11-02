import React, { useState } from 'react';
import { CommunicationApp } from '../components/CommunicationApp';
import { MOCK_TOKENS } from '../packages/test-fixtures/fixtures';
import { TokenClaims, WorkOSObjectRef } from '../packages/contracts/types';
import { WorkOSObjectDrawer } from '../components/WorkOSObjectDrawer';
import { CreateTaskModal } from '../components/CreateTaskModal';

export default function EmbeddedDevPage() {
  const [claims] = useState<TokenClaims>(MOCK_TOKENS.vedant);
  const [openedObject, setOpenedObject] = useState<WorkOSObjectRef | null>(null);
  const [taskContext, setTaskContext] = useState<{
    messageId: string;
    content: string;
    authorName: string;
  } | null>(null);

  const getAccessToken = async (): Promise<string> => {
    return claims.sub;
  };

  return (
    <div className="h-screen w-screen bg-slate-900 p-4 sm:p-6 flex flex-col">
      <div className="bg-slate-800 text-white rounded-t-2xl px-5 py-3 border border-slate-700 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="ml-2 font-mono text-slate-300">
            https://app.workos.com/org/apex-labs/communication
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            Dev Host Mount: &lt;CommunicationApp /&gt;
          </span>
          <a href="/" className="text-blue-400 hover:underline font-semibold">
            &larr; Exit Dev Preview
          </a>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-b-2xl overflow-hidden border-x border-b border-slate-700 shadow-2xl">
        <CommunicationApp
          key={claims.sub}
          getAccessToken={getAccessToken}
          onOpenObject={(obj) => setOpenedObject(obj)}
          onCreateTask={(ctx) => setTaskContext(ctx)}
          theme={{ primaryColor: '#0c1527', mode: 'light' }}
          embedded={true}
        />
      </div>

      {openedObject && (
        <WorkOSObjectDrawer
          object={openedObject}
          onClose={() => setOpenedObject(null)}
        />
      )}

      {taskContext && (
        <CreateTaskModal
          context={taskContext}
          onClose={() => setTaskContext(null)}
        />
      )}
    </div>
  );
}

