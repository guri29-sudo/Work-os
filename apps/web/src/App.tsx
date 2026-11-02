/**
 * @license
 * WorkOS Internal Communication System
 * Production entry point — no demo bar, no persona switcher.
 * Dev tools available at /dev/* in dev mode only.
 */

import React, { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { TokenClaims, WorkOSObjectRef } from './packages/contracts/types';
import { AuthScreen } from './components/AuthScreen';
import { CommunicationApp } from './components/CommunicationApp';
import { WorkOSObjectDrawer } from './components/WorkOSObjectDrawer';
import { CreateTaskModal } from './components/CreateTaskModal';

// Dev-only pages — tree-shaken in production
const AcceptanceDevPage = import.meta.env.DEV ? lazy(() => import('./dev/AcceptanceDevPage')) : null;
const ContractsDevPage = import.meta.env.DEV ? lazy(() => import('./dev/ContractsDevPage')) : null;
const EmbeddedDevPage = import.meta.env.DEV ? lazy(() => import('./dev/EmbeddedDevPage')) : null;

export default function App() {
  const [currentClaims, setCurrentClaims] = useState<TokenClaims | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hostOpenedObject, setHostOpenedObject] = useState<WorkOSObjectRef | null>(null);
  const [hostTaskContext, setHostTaskContext] = useState<{
    messageId: string;
    content: string;
    authorName: string;
  } | null>(null);

  // Dev route detection
  const [devRoute, setDevRoute] = useState(() => {
    if (import.meta.env.DEV) {
      const h = window.location.hash.replace('#', '');
      if (h.startsWith('/dev/')) return h;
    }
    return null;
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      setDevRoute(h.startsWith('/dev/') ? h : null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Schedule token refresh before expiry
  const scheduleRefresh = useCallback((claims: TokenClaims) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiresInMs = (claims.exp * 1000) - Date.now() - 30_000; // 30s before expiry
    if (expiresInMs > 0) {
      refreshTimerRef.current = setTimeout(async () => {
        // Re-fetch token from IdP using the same tag
        try {
          const API_BASE = import.meta.env.VITE_COMMUNICATION_API_URL || '';
          const idpBase = API_BASE ? API_BASE.replace(/\/api$/, '') : '';
          const res = await fetch(`${idpBase}/token?user_id=${claims.sub}`);
          if (res.ok) {
            const data = await res.json();
            tokenRef.current = data.token || data.access_token;
            if (data.claims) {
              setCurrentClaims(data.claims);
              scheduleRefresh(data.claims);
            }
          }
        } catch {
          // Token refresh failed — user will be asked to re-authenticate
        }
      }, expiresInMs);
    }
  }, []);

  const handleSignIn = useCallback((claims: TokenClaims, token?: string) => {
    setCurrentClaims(claims);
    tokenRef.current = token || claims.sub;
    scheduleRefresh(claims);
  }, [scheduleRefresh]);

  const handleSignOut = useCallback(() => {
    setCurrentClaims(null);
    tokenRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const handleSwitchAccount = useCallback(() => {
    handleSignOut();
  }, [handleSignOut]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    return tokenRef.current || '';
  }, []);

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Dev routes
  if (import.meta.env.DEV && devRoute) {
    const DevFallback = <div className="flex items-center justify-center h-screen text-slate-500 text-sm">Loading dev tool...</div>;
    if (devRoute === '/dev/acceptance' && AcceptanceDevPage) {
      return <Suspense fallback={DevFallback}><AcceptanceDevPage /></Suspense>;
    }
    if (devRoute === '/dev/contracts' && ContractsDevPage) {
      return <Suspense fallback={DevFallback}><ContractsDevPage /></Suspense>;
    }
    if (devRoute === '/dev/embedded' && EmbeddedDevPage) {
      return <Suspense fallback={DevFallback}><EmbeddedDevPage /></Suspense>;
    }
  }

  // No token → sign-in page
  if (!currentClaims) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#edf3fc] overflow-hidden select-none">
      <div className="flex-1 overflow-hidden relative">
        <CommunicationApp
          key={currentClaims.sub}
          initialClaims={currentClaims}
          getAccessToken={getAccessToken}
          onOpenObject={(obj) => setHostOpenedObject(obj)}
          onCreateTask={(ctx) => setHostTaskContext(ctx)}
          onSignOut={handleSignOut}
          onSwitchAccount={handleSwitchAccount}
          theme={{ primaryColor: '#0c1527', mode: 'light' }}
        />
      </div>

      {hostOpenedObject && (
        <WorkOSObjectDrawer
          object={hostOpenedObject}
          onClose={() => setHostOpenedObject(null)}
        />
      )}

      {hostTaskContext && (
        <CreateTaskModal
          context={hostTaskContext}
          onClose={() => setHostTaskContext(null)}
        />
      )}
    </div>
  );
}
