import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Hash,
  ArrowRight,
} from 'lucide-react';
import { WorkOSLogo } from './WorkOSLogo';
import { TokenClaims } from '../packages/contracts/types';

interface PersonaOption {
  key: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  color: string;
  tag: string;
  danger?: boolean;
}

const PERSONAS: PersonaOption[] = [
  { key: 'vedant', name: 'Vedant Kulkarni', email: 'vedant@company.com', initials: 'VK', role: 'Member', color: 'bg-blue-600', tag: 'vedant' },
  { key: 'rohan', name: 'Rohan Deshmukh', email: 'rohan@company.com', initials: 'RD', role: 'Admin', color: 'bg-[#0a1a36]', tag: 'rohan' },
  { key: 'sneha', name: 'Sneha Patil', email: 'sneha@company.com', initials: 'SP', role: 'Designer', color: 'bg-cyan-600', tag: 'sneha' },
  { key: 'alex_external', name: 'Alex (Cyberdyne)', email: 'alex@cyberdyne.io', initials: 'AV', role: 'External Tenant', color: 'bg-rose-600', tag: 'alex_external', danger: true },
];

const CLIENT_CREDENTIAL_HASHES: Record<string, { salt: string; hash: string; tag: string }> = {
  'admin@acme.example': {
    salt: 'acme-admin-salt-99',
    hash: 'b8aa4d678dfae9b010dd492fa005e15a9e0dc4bd1efce55d5e6f6a90c60279df',
    tag: 'rohan',
  },
  'rohan@company.com': {
    salt: 'acme-admin-salt-99',
    hash: 'b8aa4d678dfae9b010dd492fa005e15a9e0dc4bd1efce55d5e6f6a90c60279df',
    tag: 'rohan',
  },
  'member@acme.example': {
    salt: 'acme-member-salt-88',
    hash: '5fd7a576cf7a0561b0e3d6f19d571d28e5ab2b7cb93467efbcac1fa2a7829367',
    tag: 'vedant',
  },
  'vedant@company.com': {
    salt: 'acme-member-salt-88',
    hash: '5fd7a576cf7a0561b0e3d6f19d571d28e5ab2b7cb93467efbcac1fa2a7829367',
    tag: 'vedant',
  },
  'sneha@company.com': {
    salt: 'acme-member-salt-88',
    hash: '5fd7a576cf7a0561b0e3d6f19d571d28e5ab2b7cb93467efbcac1fa2a7829367',
    tag: 'sneha',
  },
  'alex@cyberdyne.io': {
    salt: 'acme-member-salt-88',
    hash: '5fd7a576cf7a0561b0e3d6f19d571d28e5ab2b7cb93467efbcac1fa2a7829367',
    tag: 'alex_external',
  },
};

async function verifyWebPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: 10000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const hashHex = Array.from(new Uint8Array(derived))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex === expectedHash;
  } catch {
    return false;
  }
}

async function fetchTokenFromIdP(
  emailOrTag: string,
  password?: string
): Promise<{ ok: boolean; data?: { claims: TokenClaims; token: string }; error?: string }> {
  const API_BASE = import.meta.env.VITE_COMMUNICATION_API_URL || '';
  const idpBase = API_BASE ? API_BASE.replace(/\/api$/, '') : '';
  const persona = PERSONAS.find(
    (p) => p.email.toLowerCase() === emailOrTag.toLowerCase() || p.tag === emailOrTag
  );

  if (idpBase) {
    try {
      const res = await fetch(`${idpBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: persona ? persona.email : emailOrTag,
          tag: persona?.tag,
          password: password || undefined,
        }),
      });
      if (res.status === 401) {
        return { ok: false, error: 'Invalid email or password.' };
      }
      if (!res.ok) {
        return { ok: false, error: 'Authentication failed. Please check credentials.' };
      }
      const data = await res.json();
      return { ok: true, data: { claims: data.claims || data, token: data.token || data.access_token || '' } };
    } catch {
      // Fall through to client verification
    }
  }

  // Client verification fallback
  const normEmail = (persona ? persona.email : emailOrTag).toLowerCase();
  const credRecord = CLIENT_CREDENTIAL_HASHES[normEmail];

  if (password !== undefined) {
    if (!credRecord) {
      return { ok: false, error: 'Unknown email address.' };
    }
    const isValid = await verifyWebPassword(password, credRecord.salt, credRecord.hash);
    if (!isValid) {
      return { ok: false, error: 'Invalid email or password.' };
    }
  }

  const { MOCK_TOKENS } = await import('../packages/test-fixtures/fixtures');
  const tagToUse = credRecord?.tag || persona?.tag || emailOrTag;
  const found =
    MOCK_TOKENS[tagToUse as keyof typeof MOCK_TOKENS] ||
    Object.values(MOCK_TOKENS).find((t) => t.email.toLowerCase() === normEmail);

  if (found) {
    return { ok: true, data: { claims: found, token: found.sub } };
  }
  return { ok: false, error: 'Unknown company email. Try one of the demo accounts.' };
}

interface AuthScreenProps {
  onSignIn: (claims: TokenClaims, token?: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your work email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    const result = await fetchTokenFromIdP(email.trim(), password);
    setLoading(false);
    if (result.ok && result.data) {
      onSignIn(result.data.claims, result.data.token);
    } else {
      setErrorMsg(result.error || 'Invalid email or password.');
    }
  };

  const selectPersona = async (tag: string) => {
    const persona = PERSONAS.find((p) => p.tag === tag);
    if (!persona) return;
    setEmail(persona.email);
    setErrorMsg('');
    setLoading(true);
    const result = await fetchTokenFromIdP(persona.tag);
    setLoading(false);
    if (result.ok && result.data) {
      onSignIn(result.data.claims, result.data.token);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[var(--color-bg-app)] flex flex-col justify-between p-4 md:p-8 selection:bg-blue-600 selection:text-white">
      {/* Central Card Container */}
      <div className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left Panel: White Login Card with Blue Accents */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-[0_10px_35px_rgba(37,99,235,0.06)] border border-blue-100 flex flex-col justify-between">
            <div>
              {/* Header: Logo */}
              <div className="flex items-center justify-between mb-8">
                <WorkOSLogo theme="light" size="md" />
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              {/* Single Sign-in View */}
              <div className="space-y-6">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-2">
                    WORKSPACE SIGN IN
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                    Welcome back.
                  </h1>
                  <p className="text-sm text-slate-500">
                    Sign in to continue to your workspace.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Work email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="name@company.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-12 py-2.5 bg-blue-50/40 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 mt-3"
                  >
                    <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Sign-in Accounts */}
            <div className="mt-8 pt-6 border-t border-blue-50">
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block mb-2.5">
                Quick Sign-in
              </span>
              <div className="grid grid-cols-2 gap-2 text-left">
                {PERSONAS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={loading}
                    onClick={() => selectPersona(p.tag)}
                    className={`p-2.5 rounded-xl border text-xs transition flex items-center gap-2 disabled:opacity-50 ${
                      p.danger
                        ? 'bg-rose-50/70 hover:bg-rose-100/70 border-rose-200'
                        : 'bg-blue-50/50 hover:bg-blue-100/60 border-blue-200/60'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full ${p.color} text-white flex items-center justify-center font-bold text-[10px]`}>
                      {p.initials}
                    </div>
                    <div className="truncate">
                      <div className={`font-semibold truncate ${p.danger ? 'text-rose-900' : 'text-slate-800'}`}>{p.name}</div>
                      <div className={`text-[10px] font-medium ${p.danger ? 'text-rose-600' : 'text-blue-600'}`}>{p.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Sapphire Blue Hero Card */}
          <div className="bg-gradient-to-br from-[#061530] via-[#0b214a] to-[#0f2d65] rounded-3xl p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden shadow-2xl border border-blue-900/60">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white/90 text-xs font-medium rounded-full backdrop-blur-sm border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  PRIVATE WORKSPACE
                </span>

                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-100 via-white to-blue-200 rounded-[24px] p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] flex items-center justify-center">
                  <div className="w-full h-full bg-[#0a1a36] rounded-[18px] flex items-center justify-center shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-8 h-8 text-blue-400">
                      <path d="M12 4L3 20h18L12 4z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mt-8 mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300 block mb-3">
                  BUILT FOR TEAMS
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white mb-4">
                  Better communication. <br />
                  Stronger teams.
                </h2>
                <p className="text-blue-100/80 text-sm leading-relaxed max-w-md">
                  Every conversation, file, and project update — thoughtfully brought together with zero context switching.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-6">
              <div className="bg-white/10 hover:bg-white/15 transition border border-white/10 rounded-2xl p-3.5 flex items-center justify-between max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Messages</div>
                    <div className="text-xs text-blue-200/70">Everything in sync</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 hover:bg-white/15 transition border border-white/10 rounded-2xl p-3.5 flex items-center justify-between max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Team channels</div>
                    <div className="text-xs text-blue-200/70">Work better together</div>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo environment footer */}
      <div className="max-w-5xl mx-auto w-full text-center text-xs text-slate-400 pt-4 border-t border-blue-100">
        Demo environment - synthetic data
      </div>
    </div>
  );
};
