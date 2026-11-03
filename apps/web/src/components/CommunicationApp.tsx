import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  MessageSquare,
  Hash,
  FileText,
  Search,
  Users,
  Bell,
  Shield,
  Settings,
  Plus,
  HelpCircle,
  MoreHorizontal,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  X,
  UserCheck,
  Moon,
  Sun,
  User as UserIcon,
  Menu,
  Lock,
} from 'lucide-react';
import {
  Channel,
  CommunicationAppProps,
  Message,
  TokenClaims,
  User,
  WorkOSObjectRef,
} from '../packages/contracts/types';
import { MOCK_TOKENS } from '../packages/test-fixtures/fixtures';
import {
  communicationEngine,
  ConnectionStatus,
  WorkOSCommunicationClient,
} from '../packages/sdk/client';
import { toggleTheme } from '../utils/theme';
import { WorkOSLogo } from './WorkOSLogo';
import { HomeDashboard } from './HomeDashboard';
import { ConversationView } from './ConversationView';
import { ThreadDrawer } from './ThreadDrawer';
import { SearchModal } from './SearchModal';
import { NewMessageModal } from './NewMessageModal';
import { NewChannelModal } from './NewChannelModal';
import { ChannelAdminModal } from './ChannelAdminModal';
import { WorkOSObjectDrawer } from './WorkOSObjectDrawer';
import { CreateTaskModal } from './CreateTaskModal';
import { AuditLogViewer } from './AuditLogViewer';
import { MessagesListView } from './MessagesListView';
import { MessagesWorkspace } from './MessagesWorkspace';
import { FilesView } from './FilesView';
import { NotificationsDrawer } from './NotificationsDrawer';
import { CommunitiesView } from './CommunitiesView';

function mapClaimsToSynthetic(raw: TokenClaims | null | undefined): TokenClaims | null {
  if (!raw) return null;
  const em = (raw.email || '').toLowerCase();
  const nm = (raw.name || '').toLowerCase();
  const sub = (raw.sub || '').toLowerCase();
  let matched: TokenClaims | null = null;
  if (em === 'rohan@company.com' || nm.includes('rohan') || sub.includes('rohan')) matched = MOCK_TOKENS.rohan;
  else if (em === 'vedant@company.com' || nm.includes('vedant') || sub.includes('vedant')) matched = MOCK_TOKENS.vedant;
  else if (em === 'sneha@company.com' || nm.includes('sneha') || sub.includes('sneha')) matched = MOCK_TOKENS.sneha;
  else if (em === 'alex@cyberdyne.io' || nm.includes('alex') || sub.includes('alex')) matched = MOCK_TOKENS.alex_external;
  const base = matched || raw;
  return {
    ...base,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
}

export const CommunicationApp: React.FC<CommunicationAppProps> = ({
  getAccessToken,
  initialClaims,
  onOpenObject: hostOnOpenObject,
  onCreateTask: hostOnCreateTask,
  onSignOut,
  onSwitchAccount,
  theme,
  initialChannelId,
  embedded = false,
}) => {
  const [claims, setClaims] = useState<TokenClaims | null>(() => mapClaimsToSynthetic(initialClaims));
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/app\/(?:channels|conversations|groups)\/([^/]+)/);
    return initialChannelId || (match ? decodeURIComponent(match[1]) : null);
  });
  const [currentView, setCurrentView] = useState<'home' | 'messages' | 'groups' | 'conversation' | 'files' | 'communities'>(() => {
    const path = window.location.pathname;
    if (/^\/app\/(?:channels|conversations|groups)\//.test(path)) return 'conversation';
    if (path.startsWith('/app/messages')) return 'messages';
    if (path.startsWith('/app/groups')) return 'groups';
    if (path.startsWith('/app/files')) return 'files';
    if (path.startsWith('/app/communities')) return 'communities';
    return 'home';
  });
  const [messages, setMessages] = useState<Message[]>([]);

  // URL-backed application navigation: supports refresh, deep links and browser back/forward.
  useEffect(() => {
    const routeFromLocation = () => {
      const path = window.location.pathname;
      const conversation = path.match(/^\/app\/(?:channels|conversations|groups)\/([^/]+)/);
      if (conversation) {
        setActiveChannelId(decodeURIComponent(conversation[1]));
        setCurrentView('conversation');
      } else if (path.startsWith('/app/messages')) setCurrentView('messages');
      else if (path.startsWith('/app/groups')) setCurrentView('groups');
      else if (path.startsWith('/app/files')) setCurrentView('files');
      else if (path.startsWith('/app/communities')) setCurrentView('communities');
      else if (path.startsWith('/app')) setCurrentView('home');
    };
    window.addEventListener('popstate', routeFromLocation);
    return () => window.removeEventListener('popstate', routeFromLocation);
  }, []);

  useEffect(() => {
    let path = '/app';
    if (currentView === 'messages') path = '/app/messages';
    if (currentView === 'groups') path = '/app/groups';
    if (currentView === 'files') path = '/app/files';
    if (currentView === 'communities') path = '/app/communities';
    if (currentView === 'conversation' && activeChannelId) {
      const selected = channels.find((channel) => channel.id === activeChannelId);
      path = selected?.type === 'private' ? `/app/groups/${encodeURIComponent(activeChannelId)}` : `/app/conversations/${encodeURIComponent(activeChannelId)}`;
    }
    if (window.location.pathname !== path) window.history.pushState({ workos: true }, '', path);
  }, [currentView, activeChannelId, channels]);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

  // Modals & Panels
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchInitialFilter, setSearchInitialFilter] = useState('all');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelDefaultType, setNewChannelDefaultType] = useState<'public' | 'private'>('public');
  const openCreateGroup = () => { setNewChannelDefaultType('private'); setShowNewChannelModal(true); };
  const [adminChannel, setAdminChannel] = useState<Channel | null>(null);
  const [openedObject, setOpenedObject] = useState<WorkOSObjectRef | null>(null);
  const [taskModalContext, setTaskModalContext] = useState<{
    messageId: string;
    content: string;
    authorName: string;
  } | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileChannelsDrawer, setShowMobileChannelsDrawer] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');

  // Load claims from getAccessToken
  const initSession = useCallback(async () => {
    try {
      const client = new WorkOSCommunicationClient({ getAccessToken });
      const rawClaims = initialClaims || (await client.getClaims());
      const resolvedClaims = mapClaimsToSynthetic(rawClaims) || (await client.getClaims());
      setClaims(resolvedClaims);

      const userChannels = communicationEngine.getChannels(resolvedClaims);
      setChannels(userChannels);

      if (initialChannelId) {
        setActiveChannelId(initialChannelId);
        setCurrentView('conversation');
      }
    } catch (err) {
      // Session init failed silently
    }
  }, [getAccessToken, initialChannelId]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Load messages for active channel
  const loadChannelMessages = useCallback(
    (channelId: string) => {
      if (!claims) return;
      try {
        const msgs = communicationEngine.getMessages(claims, channelId);
        setMessages(msgs);
        communicationEngine.markChannelRead(channelId);
      } catch (err: any) {
        // Channel message load failed
      }
    },
    [claims]
  );

  useEffect(() => {
    if (activeChannelId && claims) {
      loadChannelMessages(activeChannelId);
    }
  }, [activeChannelId, claims, loadChannelMessages]);

  // Real-time engine event subscriptions
  useEffect(() => {
    const unsubMsg = communicationEngine.subscribe('message.created', (newMsg: Message) => {
      if (newMsg.channel_id === activeChannelId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      // Refresh channels for unread counters and snippets
      if (claims) {
        setChannels(communicationEngine.getChannels(claims));
      }
    });

    const unsubUpdated = communicationEngine.subscribe('message.updated', (updated: Message) => {
      if (updated.channel_id === activeChannelId) {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    });

    const unsubChan = communicationEngine.subscribe('channel.created', () => {
      if (claims) setChannels(communicationEngine.getChannels(claims));
    });

    const unsubChanUp = communicationEngine.subscribe('channel.updated', () => {
      if (claims) setChannels(communicationEngine.getChannels(claims));
    });

    const loadNotifCount = () => {
      if (claims) {
        setUnreadNotificationsCount(communicationEngine.getUnreadNotificationsCount(claims));
      }
    };
    loadNotifCount();
    const unsubNotifCreated = communicationEngine.subscribe('notification.created', () => {
      loadNotifCount();
      if (claims) setChannels(communicationEngine.getChannels(claims));
    });
    const unsubNotifUpdated = communicationEngine.subscribe('notification.updated', loadNotifCount);
    const unsubNotifAllRead = communicationEngine.subscribe('notification.all_read', loadNotifCount);

    const unsubConn = communicationEngine.subscribe(
      'connection.changed',
      (status: ConnectionStatus) => {
        setConnectionStatus(status);
      }
    );

    return () => {
      unsubMsg();
      unsubUpdated();
      unsubChan();
      unsubChanUp();
      unsubNotifCreated();
      unsubNotifUpdated();
      unsubNotifAllRead();
      unsubConn();
    };
  }, [activeChannelId, claims]);

  // ⌘K Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setCurrentView('conversation');
    setActiveThreadMessage(null);
  };

  const handleOpenObject = (obj: WorkOSObjectRef) => {
    if (hostOnOpenObject) {
      hostOnOpenObject(obj);
    }
    setOpenedObject(obj);
  };

  const handleCreateTask = (ctx: {
    messageId: string;
    content: string;
    authorName: string;
  }) => {
    if (hostOnCreateTask) {
      hostOnCreateTask(ctx);
    }
    setTaskModalContext(ctx);
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  if (!claims) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f4f6fa]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">
            Validating WorkOS signed session claims...
          </p>
        </div>
      </div>
    );
  }

  const userInitials = claims.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const totalUnread = channels.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Dynamic document title with unread notifications badge
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = totalUnread > 0 ? `(${totalUnread}) WorkOS Communication` : 'WorkOS Communication';
    }
  }, [totalUnread]);
  const companyDisplayName =
    claims.company_id === 'comp_external_2' ? 'Cyberdyne Systems Corp' : 'WorkOS Enterprise Labs';
  const companyName = companyDisplayName;

  return (
    <div className="flex h-screen w-full bg-[var(--color-bg-app)] overflow-hidden select-none font-sans">
      {/* Left Sidebar: Hidden on mobile (<768px), icon rail on 768-1023px (w-16), collapsible on >=1024px */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 border-r border-blue-900/60 z-20 bg-[#0a1a36] text-blue-100 transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-16 lg:w-64'
        }`}
      >
        <div>
          {/* Logo & Workspace Title + Collapse Toggle */}
          <div className="px-3 lg:px-5 py-5 border-b border-blue-900/60 flex items-center justify-between">
            <div className={sidebarCollapsed ? 'hidden' : 'hidden lg:block'}>
              <WorkOSLogo theme="dark" size="md" />
            </div>
            <div className={sidebarCollapsed ? 'block mx-auto' : 'block lg:hidden mx-auto'}>
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                W
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-2 lg:px-4 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-170px)]">
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider text-blue-300 block px-3 mb-2 ${
                  sidebarCollapsed ? 'hidden' : 'hidden lg:block'
                }`}
              >
                WORKSPACE
              </span>
              <nav className="space-y-1">
                {/* Home */}
                <button
                  onClick={() => {
                    setCurrentView('home');
                    setActiveThreadMessage(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'home'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  } ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
                  title="Home"
                  aria-label="Home"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Home</span>
                </button>

                {/* Messages */}
                <button
                  onClick={() => {
                    setCurrentView('messages');
                    setActiveThreadMessage(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'messages'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  } ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-between'}`}
                  title="Messages"
                  aria-label="Messages"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Messages</span>
                  </div>
                  {totalUnread > 0 ? (
                    <span
                      className={`px-1.5 py-0.5 bg-blue-900 text-blue-200 rounded-md text-[10px] font-mono ${
                        sidebarCollapsed ? 'hidden' : 'hidden lg:inline'
                      }`}
                    >
                      {totalUnread}
                    </span>
                  ) : null}
                </button>

                {/* Group chats */}
                <button
                  onClick={() => { setCurrentView('groups'); setActiveThreadMessage(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'groups' ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30' : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  } ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
                  title="Group chats" aria-label="Group chats"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Group chats</span>
                </button>
                <button
                  onClick={openCreateGroup}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-violet-200/80 hover:text-white hover:bg-violet-500/10 transition ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
                  title="Create group"
                  aria-label="Create group"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Create group</span>
                </button>

                {/* Channels */}
                <button
                  onClick={() => {
                    const firstChan = channels.find((c) => c.type !== 'direct');
                    if (firstChan) handleSelectChannel(firstChan.id);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'conversation' && activeChannel?.type !== 'direct'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  } ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
                  title="Channels"
                  aria-label="Channels"
                >
                  <Hash className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Channels</span>
                </button>

                {/* Communities */}
                <button
                  onClick={() => { setCurrentView('communities'); setActiveThreadMessage(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'communities' ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30' : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                  } ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
                  title="Communities" aria-label="Communities"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Communities</span>
                </button>

                {/* Files */}
                <button
                  onClick={() => {
                    setCurrentView('files');
                    setActiveThreadMessage(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    currentView === 'files'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  } ${sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
                  title="Files"
                  aria-label="Files"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Files</span>
                </button>

                {/* Search */}
                <button
                  onClick={() => {
                    setSearchInitialFilter('all');
                    setShowSearchModal(true);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition ${
                    sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'
                  }`}
                  title="Search"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Search</span>
                </button>

                {/* People */}
                <button
                  onClick={() => setShowNewMessageModal(true)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition ${
                    sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'
                  }`}
                  title="People"
                  aria-label="People"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>People</span>
                </button>

                {/* Notifications */}
                <button
                  onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition ${
                    sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'
                  }`}
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <div className="relative shrink-0">
                    <Bell className="w-4 h-4" />
                    {(unreadNotificationsCount > 0 || totalUnread > 0) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>
                    Notifications
                  </span>
                </button>

                {/* Admin (Permission-based) */}
                {(claims.permissions.includes('communication.audit.read') ||
                  claims.permissions.includes('communication.channel.manage') ||
                  claims.permissions.includes('communication.member.manage')) && (
                  <button
                    onClick={() => {
                      if (claims.permissions.includes('communication.audit.read')) {
                        setShowAuditModal(true);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition ${
                      sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'
                    }`}
                    title="Admin"
                    aria-label="Admin"
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Admin</span>
                  </button>
                )}

                {/* Preferences */}
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition ${
                    sidebarCollapsed ? 'justify-center' : 'justify-center lg:justify-start'
                  }`}
                  title="Preferences & Profile"
                  aria-label="Preferences"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'hidden' : 'hidden lg:inline'}>Preferences</span>
                </button>
              </nav>
            </div>

            {/* YOUR TEAMS section */}
            <div className={`pt-2 ${sidebarCollapsed ? 'hidden' : 'hidden lg:block'}`}>
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  YOUR TEAMS
                </span>
                {claims.permissions.includes('communication.channel.create') && (
                  <button
                    onClick={() => setShowNewChannelModal(true)}
                    className="text-slate-400 hover:text-white transition"
                    title="Create new channel"
                    aria-label="Create new channel"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {channels
                  .filter((c) => c.type !== 'direct')
                  .slice(0, 6)
                  .map((chan) => {
                    const isActive = activeChannelId === chan.id && currentView === 'conversation';
                    return (
                      <button
                        key={chan.id}
                        onClick={() => handleSelectChannel(chan.id)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition text-left group ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-blue-200/70 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              chan.unread_count
                                ? 'bg-amber-400 ring-2 ring-amber-400/40 animate-pulse'
                                : isActive
                                ? 'bg-white'
                                : 'bg-blue-400/40 group-hover:bg-white'
                            }`}
                          />
                          <span className={`truncate ${chan.unread_count ? 'font-bold text-white' : ''}`}>
                            {chan.name}
                          </span>
                        </div>
                        {chan.unread_count ? (
                          <span className="w-4 h-4 rounded-full bg-white text-blue-900 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {chan.unread_count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* User Account / Persona Footer Bar */}
        <div className="p-3 lg:p-4 border-t border-blue-900/60 relative">
          <div className="flex items-center justify-between">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
              title={claims.name}
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mx-auto lg:mx-0">
                {userInitials[0]}
              </div>
              <div className={`min-w-0 ${sidebarCollapsed ? 'hidden' : 'hidden lg:block'}`}>
                <div className="text-xs font-bold text-white truncate group-hover:text-blue-200">
                  {claims.name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-blue-300/70 truncate">Workspace member</div>
              </div>
            </div>

            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`p-1 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition ${
                sidebarCollapsed ? 'hidden' : 'hidden lg:block'
              }`}
              title="Session & persona menu"
              aria-label="User menu"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* User Popover Menu */}
          {showUserMenu && (
            <div className="absolute left-3 right-3 bottom-full mb-2 bg-[#0a1a36] border border-blue-800 rounded-2xl shadow-2xl p-2.5 z-50 text-xs text-white">
              <div className="px-3 py-2 border-b border-blue-900/80 mb-1">
                <div className="font-bold text-blue-100">{claims.name}</div>
                <div className="text-[10px] text-blue-300">{claims.email}</div>
                <div className="text-[10px] text-blue-200 mt-1 font-medium">
                  {companyDisplayName}
                </div>
              </div>

              <div className="space-y-1">
                {claims.permissions.includes('communication.audit.read') && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowAuditModal(true);
                    }}
                    className="w-full px-3 py-2 hover:bg-white/10 rounded-xl text-left flex items-center gap-2 transition"
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span>Audit Logs</span>
                  </button>
                )}

                {/* Theme Toggle */}
                <button
                  onClick={() => toggleTheme()}
                  className="w-full px-3 py-2 hover:bg-white/10 rounded-xl text-left flex items-center gap-2 transition"
                >
                  <Moon className="w-3.5 h-3.5 text-blue-300" />
                  <span>Toggle Theme (Light / Dark)</span>
                </button>

                {/* Switch Account */}
                {onSwitchAccount && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSwitchAccount();
                    }}
                    className="w-full px-3 py-2 hover:bg-white/10 rounded-xl text-left flex items-center gap-2 text-blue-200 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Switch Account</span>
                  </button>
                )}

                {/* Sign Out */}
                {onSignOut && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut();
                    }}
                    className="w-full px-3 py-2 hover:bg-rose-500/20 text-rose-300 rounded-xl text-left flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--color-bg-app)] relative">
        {/* Top Header Bar */}
        <header className="h-14 sm:h-16 px-2.5 sm:px-6 lg:px-8 bg-[var(--color-bg-app)] border-b border-[var(--color-border)] flex items-center justify-between shrink-0 z-10 gap-2 sm:gap-4">
          {/* Mobile Channels Drawer Toggle Button with Unread Indicator Dot */}
          <div className="relative md:hidden shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileChannelsDrawer(true)}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 rounded-xl text-slate-600 dark:text-slate-200 hover:text-blue-700 hover:bg-white/80 active:bg-blue-100 transition"
              aria-label="Open channels list"
              title="Channels & Messages"
            >
              <Menu className="w-5 h-5" />
            </button>
            {totalUnread > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </div>

          {/* Omnibox Search bar */}
          <div
            onClick={() => setShowSearchModal(true)}
            className="flex-1 max-w-md bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-slate-700 px-3 py-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-300 hover:border-blue-300 hover:shadow-xs transition cursor-pointer shadow-2xs min-w-0"
            role="search"
            aria-label="Search messages, files, and people"
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Search messages, files...</span>
            </div>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-slate-600 shrink-0">
              ⌘K
            </kbd>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0 pr-1">
            {/* Connection Status Badge (hidden on mobile) */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-blue-100 px-3 py-1.5 rounded-xl shadow-2xs">
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="font-semibold text-slate-700">
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'reconnecting' ? 'Reconnecting…' :
                 'Offline'}
              </span>
            </div>

            {/* Help / Info Icon (hidden on mobile) */}
            <div
              className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-white transition cursor-help"
              title="WorkOS Internal Communication System"
              aria-label="System Info"
            >
              <HelpCircle className="w-4 h-4" />
            </div>

            {/* Notification Bell with unread dot (Mobile & PC) */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl text-slate-500 dark:text-slate-300 hover:text-blue-700 hover:bg-white dark:hover:bg-slate-800 transition"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              {(unreadNotificationsCount > 0 || totalUnread > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-[#edf3fc] dark:ring-slate-900 animate-pulse" />
              )}
            </div>

            {/* Avatar Pill */}
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer shrink-0 ring-2 ring-white/60 dark:ring-slate-700"
              title={claims.name}
            >
              {userInitials}
            </div>

            {/* "+ New message" Button (desktop only, mobile has FAB) */}
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="hidden sm:flex px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl items-center gap-1.5 shadow-sm shadow-blue-500/25 transition min-h-[44px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New message</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <div className={`flex-1 flex overflow-hidden ${currentView === 'home' ? 'pb-16 md:pb-0' : ''}`}>
          {currentView === 'home' ? (
            <HomeDashboard
              claims={claims}
              channels={channels}
              totalUnread={totalUnread}
              onSelectChannel={handleSelectChannel}
              onOpenSearch={(filter) => {
                setSearchInitialFilter(filter || 'all');
                setShowSearchModal(true);
              }}
              onOpenAuditLogs={() => setShowAuditModal(true)}
              onOpenNewMessage={() => setShowNewMessageModal(true)}
            />
          ) : currentView === 'files' ? (
            <FilesView claims={claims} channels={channels} />
          ) : currentView === 'communities' ? (
            <CommunitiesView claims={claims} channels={channels} onCreateGroup={openCreateGroup} onOpenGroup={handleSelectChannel} />
          ) : (
            <MessagesWorkspace
              showConversationOnMobile={currentView === 'conversation' && !!activeChannel}
              list={
                <MessagesListView
                  claims={claims}
                  channels={currentView === 'groups' ? channels.filter((c) => c.type === 'private') : channels}
                  activeChannelId={activeChannelId || ''}
                  onSelectChannel={handleSelectChannel}
                  onNewMessage={() => setShowNewMessageModal(true)}
                />
              }
              conversation={
                activeChannel ? (
                  <ConversationView
                    claims={claims}
                    channel={activeChannel}
                    channels={channels}
                    messages={messages}
                    hasUnreadChannels={channels.some((c) => c.id !== activeChannel.id && (c.unread_count || 0) > 0)}
                    onBack={() => {
                      setCurrentView(activeChannel.type === 'private' ? 'groups' : 'messages');
                      setShowMobileChannelsDrawer(false);
                      setActiveThreadMessage(null);
                    }}
                    onOpenChannelList={() => setShowMobileChannelsDrawer(true)}
                    onOpenThread={(msg) => setActiveThreadMessage(msg)}
                    onOpenObject={handleOpenObject}
                    onCreateTask={handleCreateTask}
                    onOpenChannelAdmin={(chan) => setAdminChannel(chan)}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[#6f6f78] text-sm">
                    Select a conversation to start chatting.
                  </div>
                )
              }
            />
          )}

          {/* Sliding Thread Drawer (Full-screen sheet on mobile) */}
          {activeThreadMessage && activeChannelId && (
            <ThreadDrawer
              claims={claims}
              parentMessage={activeThreadMessage}
              channelId={activeChannelId}
              onClose={() => setActiveThreadMessage(null)}
            />
          )}

          {/* Notifications Drawer */}
          {showNotificationsDrawer && claims && (
            <NotificationsDrawer
              claims={claims}
              onClose={() => setShowNotificationsDrawer(false)}
              onNavigate={(channelId) => {
                handleSelectChannel(channelId);
                setShowNotificationsDrawer(false);
              }}
            />
          )}
        </div>

        {/* Mobile Floating Action Button (FAB) for "New message" */}
        {(currentView === 'home' || currentView === 'messages') && (
          <button
            onClick={() => setShowNewMessageModal(true)}
            className="md:hidden fixed bottom-20 right-4 z-30 min-h-[50px] min-w-[50px] rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-xl shadow-blue-600/40 flex items-center justify-center transition"
            aria-label="New message"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Mobile Bottom Tab Bar (<768px): visible on home/overview, hidden in full-screen conversation view */}
        {currentView !== 'conversation' && (
          <nav
            aria-label="Mobile Navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a1a36] text-blue-100 border-t border-blue-900/60 z-40 flex items-center justify-around safe-pb shadow-2xl"
          >
            <button
              onClick={() => {
                setCurrentView('home');
                setActiveThreadMessage(null);
              }}
              className={`touch-target flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
                currentView === 'home' ? 'text-blue-400 font-bold' : 'text-blue-200/70 hover:text-white'
              }`}
              aria-label="Home tab"
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('messages');
                setActiveThreadMessage(null);
              }}
              className={`touch-target flex flex-col items-center justify-center gap-1 text-[10px] font-semibold relative transition ${
                currentView === 'messages' ? 'text-blue-400 font-bold' : 'text-blue-200/70 hover:text-white'
              }`}
              aria-label="Messages tab"
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5" />
                {totalUnread > 0 ? (
                  <span className="absolute -top-1 -right-2 px-1 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-mono">
                    {totalUnread}
                  </span>
                ) : null}
              </div>
              <span>Messages</span>
            </button>

            <button
              onClick={() => {
                setShowMobileChannelsDrawer(true);
              }}
              className={`touch-target flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
                showMobileChannelsDrawer || (activeChannelId && activeChannel?.type !== 'direct')
                  ? 'text-blue-400 font-bold'
                  : 'text-blue-200/70 hover:text-white'
              }`}
              aria-label="Channels tab"
            >
              <div className="relative">
                <Hash className="w-5 h-5" />
                {channels.some((c) => c.type !== 'direct' && (c.unread_count || 0) > 0) && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-[#0a1a36] animate-pulse" />
                )}
              </div>
              <span>Channels</span>
            </button>

            <button
              onClick={() => {
                setSearchInitialFilter('all');
                setShowSearchModal(true);
              }}
              className="touch-target flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-blue-200/70 hover:text-white transition"
              aria-label="Search tab"
            >
              <Search className="w-5 h-5" />
              <span>Search</span>
            </button>

            <button
              onClick={() => setShowMobileMore(!showMobileMore)}
              className={`touch-target flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
                showMobileMore ? 'text-blue-400 font-bold' : 'text-blue-200/70 hover:text-white'
              }`}
              aria-label="More options"
              aria-expanded={showMobileMore}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>More</span>
            </button>
          </nav>
        )}

        {/* Mobile More Sheet */}
        {showMobileMore && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
            <div className="bg-[#0a1a36] border-t border-blue-900 text-white rounded-t-3xl p-5 space-y-4 animate-slideUp max-h-[85vh] overflow-y-auto safe-pb">
              <div className="flex items-center justify-between pb-3 border-b border-blue-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-md">
                    {userInitials}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{claims.name}</div>
                    <div className="text-xs text-blue-300/80">{claims.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileMore(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white"
                  aria-label="Close more menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <button
                  onClick={() => {
                    setShowMobileMore(false);
                    setShowNewMessageModal(true);
                  }}
                  className="min-h-[44px] p-3 rounded-xl bg-white/10 hover:bg-white/15 flex items-center gap-2.5 transition"
                >
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>People & DMs</span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMore(false);
                    setCurrentView('files');
                    setActiveThreadMessage(null);
                  }}
                  className="min-h-[44px] p-3 rounded-xl bg-white/10 hover:bg-white/15 flex items-center gap-2.5 transition"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Files</span>
                </button>

                {claims.permissions.includes('communication.audit.read') && (
                  <button
                    onClick={() => {
                      setShowMobileMore(false);
                      setShowAuditModal(true);
                    }}
                    className="min-h-[44px] p-3 rounded-xl bg-white/10 hover:bg-white/15 flex items-center gap-2.5 transition"
                  >
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>Audit Logs</span>
                  </button>
                )}

                <button
                  onClick={() => toggleTheme()}
                  className="min-h-[44px] p-3 rounded-xl bg-white/10 hover:bg-white/15 flex items-center gap-2.5 transition"
                >
                  <Moon className="w-4 h-4 text-blue-300" />
                  <span>Toggle Theme</span>
                </button>

                {onSwitchAccount && (
                  <button
                    onClick={() => {
                      setShowMobileMore(false);
                      onSwitchAccount();
                    }}
                    className="min-h-[44px] p-3 rounded-xl bg-white/10 hover:bg-white/15 flex items-center gap-2.5 transition"
                  >
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    <span>Switch Account</span>
                  </button>
                )}

                {onSignOut && (
                  <button
                    onClick={() => {
                      setShowMobileMore(false);
                      onSignOut();
                    }}
                    className="min-h-[44px] p-3 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 flex items-center gap-2.5 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-blue-900/60 text-xs text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>System Operational</span>
                </div>
                <span className="text-[11px] text-blue-300 font-medium">{companyDisplayName}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Modals */}
      {showSearchModal && (
        <SearchModal
          claims={claims}
          initialFilter={searchInitialFilter}
          onClose={() => setShowSearchModal(false)}
          onSelectChannel={handleSelectChannel}
          onOpenObject={handleOpenObject}
        />
      )}

      {showNewMessageModal && (
        <NewMessageModal
          claims={claims}
          onClose={() => setShowNewMessageModal(false)}
          onSelectChannel={handleSelectChannel}
          onOpenNewChannelModal={() => setShowNewChannelModal(true)}
        />
      )}

      {showNewChannelModal && (
        <NewChannelModal
          claims={claims}
          initialType={newChannelDefaultType}
          onClose={() => setShowNewChannelModal(false)}
          onChannelCreated={(newChan) => {
            setShowNewChannelModal(false);
            setChannels(communicationEngine.getChannels(claims));
            handleSelectChannel(newChan.id);
          }}
        />
      )}

      {adminChannel && (
        <ChannelAdminModal
          claims={claims}
          channel={adminChannel}
          onClose={() => setAdminChannel(null)}
          onChannelUpdated={(updated) => {
            setAdminChannel(updated);
            setChannels(communicationEngine.getChannels(claims));
          }}
        />
      )}

      {openedObject && (
        <WorkOSObjectDrawer
          object={openedObject}
          onClose={() => setOpenedObject(null)}
          onRequestCreateTask={() => {
            setOpenedObject(null);
            handleCreateTask({
              messageId: 'linked_object',
              content: openedObject.title,
              authorName: 'WorkOS System',
            });
          }}
        />
      )}

      {taskModalContext && (
        <CreateTaskModal
          context={taskModalContext}
          onClose={() => setTaskModalContext(null)}
        />
      )}

      {showAuditModal && claims.permissions.includes('communication.audit.read') && (
        <AuditLogViewer
          claims={claims}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* Mobile Slide-Over Channels & DMs Drawer */}
      {showMobileChannelsDrawer && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fadeIn">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowMobileChannelsDrawer(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-[85vw] max-w-xs bg-[#0c1527] text-white h-full flex flex-col shadow-2xl z-10 animate-slideRight">
            {/* Drawer Header */}
            <div className="p-4 border-b border-blue-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <WorkOSLogo theme="dark" size="sm" />
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">{companyName}</div>
                  <div className="text-[10px] text-blue-300 truncate">{claims.name}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileChannelsDrawer(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl text-blue-300 hover:text-white hover:bg-white/10 transition"
                aria-label="Close channels drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action: New Message */}
            <div className="p-3 border-b border-blue-900/40">
              <button
                onClick={() => {
                  setShowMobileChannelsDrawer(false);
                  setShowNewMessageModal(true);
                }}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>New message</span>
              </button>
            </div>

            {/* Drawer Content: Scrollable list of Channels & DMs */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Channels Section */}
              <div>
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/70">
                    CHANNELS ({channels.filter((c) => c.type !== 'direct').length})
                  </span>
                  {claims.permissions.includes('communication.channel.create') && (
                    <button
                      onClick={() => {
                        setShowMobileChannelsDrawer(false);
                        setShowNewChannelModal(true);
                      }}
                      className="p-1 text-blue-300 hover:text-white hover:bg-white/10 rounded transition"
                      title="Create channel"
                      aria-label="Create channel"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {channels
                    .filter((c) => c.type !== 'direct')
                    .map((chan) => {
                      const isActive = activeChannelId === chan.id && currentView === 'conversation';
                      return (
                        <button
                          key={chan.id}
                          onClick={() => {
                            handleSelectChannel(chan.id);
                            setShowMobileChannelsDrawer(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left group min-h-[40px] ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'text-blue-200/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {Boolean(chan.unread_count) ? (
                              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/40 animate-pulse shrink-0" />
                            ) : chan.type === 'private' ? (
                              <Lock className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                            ) : (
                              <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                            <span className={`truncate ${Boolean(chan.unread_count) ? 'font-bold text-white' : ''}`}>
                              {chan.name}
                            </span>
                          </div>
                          {Boolean(chan.unread_count) && (
                            <span className="px-1.5 py-0.5 rounded-full bg-white text-blue-900 font-mono text-[10px] font-bold">
                              {chan.unread_count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Direct Messages Section */}
              <div>
                <div className="px-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/70">
                    DIRECT MESSAGES ({channels.filter((c) => c.type === 'direct').length})
                  </span>
                </div>

                <div className="space-y-1">
                  {channels
                    .filter((c) => c.type === 'direct')
                    .map((chan) => {
                      const isActive = activeChannelId === chan.id && currentView === 'conversation';
                      const initials = chan.name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <button
                          key={chan.id}
                          onClick={() => {
                            handleSelectChannel(chan.id);
                            setShowMobileChannelsDrawer(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left group min-h-[40px] ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'text-blue-200/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="relative shrink-0">
                              <div className="w-6 h-6 rounded-full bg-blue-500/30 text-blue-200 flex items-center justify-center font-bold text-[10px] border border-blue-400/30">
                                {initials}
                              </div>
                              {Boolean(chan.unread_count) && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0c1527] animate-pulse" />
                              )}
                            </div>
                            <span className={`truncate ${Boolean(chan.unread_count) ? 'font-bold text-white' : ''}`}>{chan.name}</span>
                          </div>
                          {Boolean(chan.unread_count) && (
                            <span className="px-1.5 py-0.5 rounded-full bg-white text-blue-900 font-mono text-[10px] font-bold">
                              {chan.unread_count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Drawer Footer with current user info */}
            <div className="p-3 border-t border-blue-900/60 bg-[#091322] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {userInitials[0]}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">{claims.name}</div>
                  <div className="text-[10px] text-blue-300 truncate">{claims.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMobileChannelsDrawer(false);
                  onSignOut?.();
                }}
                className="p-1.5 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
