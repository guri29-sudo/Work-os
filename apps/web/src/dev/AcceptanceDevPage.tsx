import React, { useState } from 'react';
import { AcceptanceSuiteModal } from '../components/AcceptanceSuiteModal';
import { MOCK_TOKENS } from '../packages/test-fixtures/fixtures';
import { TokenClaims } from '../packages/contracts/types';

export default function AcceptanceDevPage() {
  const [claims, setClaims] = useState<TokenClaims>(MOCK_TOKENS.vedant);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Developer Test Runner</h1>
            <p className="text-xs text-slate-500">Route: /dev/acceptance (Dev-only, tree-shaken in production)</p>
          </div>
          <a href="/" className="text-xs font-semibold text-blue-600 hover:underline">
            &larr; Back to App
          </a>
        </div>
        <AcceptanceSuiteModal
          claims={claims}
          onClose={() => { window.location.href = '/'; }}
          onSwitchUser={(newClaims) => setClaims(newClaims)}
          onSelectChannel={(chanId) => console.log('Selected channel:', chanId)}
        />
      </div>
    </div>
  );
}

