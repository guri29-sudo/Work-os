import React, { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Search, Hash, ArrowUpRight, ShieldCheck, X } from 'lucide-react';
import { Channel, TokenClaims } from '../packages/contracts/types';

type Community = { id: string; name: string; description: string; createdBy: string; createdAt: string; groupIds: string[]; members: string[] };
interface Props { claims: TokenClaims; channels: Channel[]; onCreateGroup: () => void; onOpenGroup: (id: string) => void; }
const storageKey = 'workos_communities_v1';

export const CommunitiesView: React.FC<Props> = ({ claims, channels, onCreateGroup, onOpenGroup }) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    try { setCommunities(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { setCommunities([]); }
  }, []);
  const save = (next: Community[]) => { setCommunities(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const visible = useMemo(() => communities.filter(c => `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase())), [communities, query]);
  const selected = communities.find(c => c.id === active) || null;
  const create = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (name.trim().length < 3) { setError('Community name must contain at least 3 characters.'); return; }
    const community: Community = { id: `community_${crypto.randomUUID()}`, name: name.trim(), description: description.trim(), createdBy: claims.sub, createdAt: new Date().toISOString(), groupIds: [], members: [claims.sub] };
    save([community, ...communities]); setName(''); setDescription(''); setCreating(false); setActive(community.id);
  };
  const attachGroup = (groupId: string) => {
    if (!selected || selected.groupIds.includes(groupId)) return;
    save(communities.map(c => c.id === selected.id ? { ...c, groupIds: [...c.groupIds, groupId] } : c));
  };
  const groups = channels.filter(c => c.type !== 'direct');
  return <section className="flex-1 min-w-0 overflow-y-auto bg-[#08080c] text-white p-4 sm:p-7">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
        <div><p className="text-xs uppercase tracking-[.22em] text-violet-300 font-semibold mb-2">WorkOS workspace</p><h1 className="text-2xl sm:text-3xl font-semibold">Communities</h1><p className="text-sm text-[#92919c] mt-2">Bring teams and conversations together in one place.</p></div>
        <div className="flex gap-2"><button onClick={onCreateGroup} className="rounded-xl border border-[#34343d] px-4 py-2.5 text-sm hover:bg-white/5">Create group</button><button onClick={() => setCreating(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500"><Plus className="inline h-4 w-4 mr-1"/>New community</button></div>
      </div>
      <div className="relative max-w-md mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#777783]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search communities" className="w-full rounded-xl border border-[#303039] bg-[#17171d] py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-500"/></div>
      {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-[#35353e] bg-[#111116] p-10 text-center"><Users className="mx-auto h-9 w-9 text-violet-300 mb-3"/><h2 className="font-semibold">No communities yet</h2><p className="text-sm text-[#92919c] mt-1">Create a community to organize your teams and group conversations.</p><button onClick={()=>setCreating(true)} className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold">Create your first community</button></div> : <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)] gap-5"><div className="grid sm:grid-cols-2 gap-3 content-start">{visible.map(c=><button key={c.id} onClick={()=>setActive(c.id)} className={`text-left rounded-2xl border p-5 transition ${active===c.id?'border-violet-500 bg-violet-500/10':'border-[#303039] bg-[#15151b] hover:border-[#55515f]'}`}><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><Users className="h-5 w-5"/></span><ArrowUpRight className="h-4 w-4 text-[#777783]"/></div><h3 className="mt-4 font-semibold">{c.name}</h3><p className="mt-1 text-sm text-[#92919c] line-clamp-2 min-h-10">{c.description || 'No description added.'}</p><div className="mt-4 flex items-center gap-3 text-xs text-[#85848e]"><span>{c.members.length} member</span><span>{c.groupIds.length} groups</span></div></button>)}</div>
      <aside className="rounded-2xl border border-[#303039] bg-[#121218] p-5 min-h-64">{selected?<><div className="flex items-start justify-between"><div><div className="text-xs uppercase tracking-wider text-violet-300">Community details</div><h2 className="text-xl font-semibold mt-2">{selected.name}</h2></div><ShieldCheck className="h-5 w-5 text-violet-300"/></div><p className="text-sm text-[#92919c] mt-2">{selected.description || 'No description added.'}</p><div className="border-t border-[#303039] mt-5 pt-4"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Community groups</h3><button onClick={onCreateGroup} className="text-xs text-violet-300 hover:text-violet-200">+ Create group</button></div>{selected.groupIds.length?selected.groupIds.map(id=>{const g=groups.find(x=>x.id===id);return g?<button key={id} onClick={()=>onOpenGroup(id)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"><Hash className="h-4 w-4 text-violet-300"/>{g.name}</button>:null}):<p className="text-xs text-[#85848e]">No groups linked yet. Add a group below.</p>}<div className="mt-3 flex flex-wrap gap-2">{groups.filter(g=>!selected.groupIds.includes(g.id)).slice(0,6).map(g=><button key={g.id} onClick={()=>attachGroup(g.id)} className="rounded-lg border border-[#34343d] px-2.5 py-1.5 text-xs hover:border-violet-500">+ {g.name}</button>)}</div></div><p className="mt-5 text-[11px] text-amber-300/80">Community membership and group links are currently stored in this browser. Server-side community APIs are not part of the existing backend yet.</p></>:<div className="h-full flex flex-col items-center justify-center text-center text-[#85848e]"><Users className="h-8 w-8 mb-3"/><p className="text-sm">Select a community to view its groups.</p></div>}</aside></div>}
    </div>
    {creating&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"><form onSubmit={create} className="w-full max-w-md rounded-2xl border border-[#383842] bg-[#17171e] p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Create community</h2><button type="button" onClick={()=>setCreating(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close"><X className="h-4 w-4"/></button></div><label className="block text-xs text-[#aaa9b2] mt-5 mb-1.5">Community name</label><input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={60} required placeholder="e.g. Product & Engineering" className="w-full rounded-xl border border-[#383842] bg-[#0d0d12] px-3 py-3 text-sm outline-none focus:border-violet-500"/><label className="block text-xs text-[#aaa9b2] mt-4 mb-1.5">Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={240} rows={3} placeholder="What is this community for?" className="w-full resize-none rounded-xl border border-[#383842] bg-[#0d0d12] px-3 py-3 text-sm outline-none focus:border-violet-500"/>{error&&<p className="text-xs text-rose-300 mt-2">{error}</p>}<div className="flex justify-end gap-2 mt-5"><button type="button" onClick={()=>setCreating(false)} className="rounded-xl px-4 py-2 text-sm text-[#aaa9b2] hover:bg-white/5">Cancel</button><button className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500">Create community</button></div></form></div>}
  </section>;
};
