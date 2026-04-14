'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Settings, Key, Database, Loader2, CheckCircle2, UserPlus, Shield, Eye, Trash2, RotateCcw,
  User, LogOut, BookOpen, CircleDot, Users, Wifi, WifiOff
} from 'lucide-react';

interface OnlineUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastSeen: string;
}

export default function SettingsPage() {
  const { user, isAdmin, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Account creation
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [acctName, setAcctName] = useState('');
  const [acctRole, setAcctRole] = useState('VIEWER');
  const [creatingAcct, setCreatingAcct] = useState(false);
  const [acctMsg, setAcctMsg] = useState('');

  // Password reset
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Accounts list
  const [accounts, setAccounts] = useState<any[]>([]);

  // Online users
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => { if (isAdmin) fetchAccounts(); }, [isAdmin]);

  // Fetch online users and set up polling (every 30s)
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/online');
      setOnlineUsers(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  // Heartbeat: ping the server every 60s to keep online status alive
  useEffect(() => {
    const heartbeat = setInterval(() => {
      api.get('/api/health').catch(() => {});
    }, 60000);
    return () => clearInterval(heartbeat);
  }, []);

  const fetchAccounts = async () => {
    try { const d = await api.get('/api/auth/accounts'); setAccounts(d); } catch (e) { console.error(e); }
  };

  const handleMockSync = async () => {
    setSyncing(true); setSyncSuccess(false);
    try { await api.post('/api/settings/seed', {}); setSyncSuccess(true); setTimeout(() => setSyncSuccess(false), 3000); } catch (e) { console.error(e); }
    finally { setSyncing(false); }
  };

  const handleCreateAcct = async (e: React.FormEvent) => {
    e.preventDefault(); setCreatingAcct(true); setAcctMsg('');
    try {
      const res = await api.post('/api/auth/create-account', { email: acctEmail, password: acctPassword, name: acctName, role: acctRole });
      setAcctMsg(`✅ ${res.message || 'Account created!'}`);  
      setAcctEmail(''); setAcctPassword(''); setAcctName('');
      await fetchAccounts();
    } catch (error: any) { setAcctMsg(`❌ ${error.message || 'Failed to create account'}`); }
    finally { setCreatingAcct(false); }
  };

  const handleResetPassword = async () => {
    if (!resetId || !resetPassword) return;
    setResetting(true);
    try {
      await api.put(`/api/auth/reset-password/${resetId}`, { new_password: resetPassword });
      setResetId(null); setResetPassword('');
      alert('Password updated!');
    } catch (e) { console.error(e); }
    finally { setResetting(false); }
  };

  const handleDeleteAcct = async (id: string) => {
    try { await api.delete(`/api/auth/accounts/${id}`); setDeleteId(null); fetchAccounts(); } catch (e) { console.error(e); }
  };

  // Helper: check if a given account ID is online
  const isUserOnline = (id: string) => onlineUsers.some(ou => ou.id === id);

  // Get time ago string
  const timeAgo = (isoDate: string) => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    return `${mins} min ago`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1"><Settings className="mr-3 text-primary h-6 w-6" /> Settings</h1>
        <p className="text-sm text-zinc-400">Manage your account, data, and platform configuration.</p>
      </div>

      {/* ── Current User / Your Account ── */}
      <div className="rounded-2xl border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
        <h2 className="flex items-center text-lg font-medium text-white mb-4">
          <User className="mr-2 h-5 w-5 text-primary" /> Your Account
        </h2>
        {user && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 font-bold text-white text-xl shadow-lg shadow-indigo-500/20">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                {/* Online indicator */}
                <span className="absolute bottom-0 right-0 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-zinc-950" />
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-white">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                    user.role === 'ADMIN' 
                      ? 'bg-primary/15 text-primary border-primary/25' 
                      : user.role === 'CO_ADMIN' 
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' 
                        : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
                  }`}>
                    <Shield className="h-3 w-3" />
                    {user.role === 'CO_ADMIN' ? 'Co-Admin' : user.role}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <CircleDot className="h-3 w-3" />
                    Online
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 border border-white/8 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* ── Who's Online ── */}
      <div className="rounded-2xl border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
        <h2 className="flex items-center text-lg font-medium text-white mb-4">
          <Users className="mr-2 h-5 w-5 text-primary" /> Who&apos;s Online
          <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 font-normal">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            {onlineUsers.length} active
          </span>
        </h2>
        {onlineUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">No other users are currently online.</p>
        ) : (
          <div className="space-y-2">
            {onlineUsers.map(ou => {
              const isMe = ou.id === user?.id;
              return (
                <div key={ou.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  isMe ? 'bg-primary/5 border-primary/15' : 'bg-white/5 border-white/5'
                }`}>
                  {/* Avatar with online dot */}
                  <div className="relative flex-shrink-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white text-sm shadow-lg ${
                      ou.role === 'ADMIN'
                        ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-indigo-500/20'
                        : ou.role === 'CO_ADMIN'
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
                          : 'bg-gradient-to-br from-zinc-500 to-zinc-700 shadow-zinc-500/10'
                    }`}>
                      {(ou.name || ou.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border-2 border-zinc-950" />
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {ou.name || ou.email}
                        {isMe && <span className="ml-1.5 text-[10px] text-primary font-semibold">(You)</span>}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{ou.email} · {ou.role === 'CO_ADMIN' ? 'Co-Admin' : ou.role}</p>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                    <span className="text-[10px] text-zinc-600">{timeAgo(ou.lastSeen)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Start Guide (moved from Dashboard) ── */}
      <div className="rounded-2xl border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
        <h2 className="flex items-center text-lg font-medium text-white mb-5">
          <BookOpen className="mr-2 h-5 w-5 text-primary" /> Quick Start Guide
        </h2>
        <div className="space-y-4">
          {[
            { step: 1, text: <>Go to <span className="text-white font-medium">Settings</span> and click <span className="text-primary font-medium">Sync from Cricbuzz</span> to populate matches and players.</> },
            { step: 2, text: <>Go to <span className="text-white font-medium">Players</span> to register the 8 betting participants (or they are auto-seeded).</> },
            { step: 3, text: <>Go to <span className="text-white font-medium">Draws</span>, select a match, click <span className="text-primary font-medium">Enter Draw</span>, and assign each player their A/B position code.</> },
            { step: 4, text: <>After the match, click <span className="text-primary font-medium">Enter Scores</span>, type in cricket player names and their runs. Hit <span className="text-emerald-400 font-medium">Settle Match</span>.</> },
            { step: 5, text: <>Go to <span className="text-white font-medium">Settlements</span> every Tuesday to see who owes what.</> },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold border border-primary/10 score-display">
                {step}
              </span>
              <p className="text-zinc-400 leading-relaxed pt-0.5">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Admin-only sections below ── */}
      {!isAdmin ? (
        <div className="flex flex-col items-center justify-center h-32 text-center rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl">
          <Shield className="h-8 w-8 text-zinc-600 mb-2" />
          <p className="text-sm text-zinc-400">Admin privileges required for data management and account controls.</p>
        </div>
      ) : (
        <>
          {/* Sync from Cricbuzz */}
          <div className="rounded-2xl border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
            <h2 className="flex items-center text-lg font-medium text-white mb-4"><Database className="mr-2 h-5 w-5 text-primary" /> Cricbuzz Sync</h2>
            <p className="text-sm text-zinc-400 mb-4">Pulls the real IPL 2026 match schedule from Cricbuzz. Also seeds 8 betting players &amp; admin account.</p>
            <div className="flex items-center gap-3">
              <button onClick={handleMockSync} disabled={syncing} className="flex items-center justify-center min-w-[200px] rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : '🏏 Sync from Cricbuzz'}
              </button>
              {syncSuccess && <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20"><CheckCircle2 className="mr-1 h-3 w-3" /> Synced!</span>}
            </div>
            <p className="text-xs text-zinc-600 mt-3">💡 Scores auto-fetch daily at 4:00 PM EST from Cricbuzz.</p>
          </div>

          {/* Create Account */}
          <div className="rounded-2xl border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
            <h2 className="flex items-center text-lg font-medium text-white mb-4"><UserPlus className="mr-2 h-5 w-5 text-primary" /> Create Account</h2>
            <p className="text-sm text-zinc-400 mb-4">Add a Co-Admin (full access) or Viewer (read-only for players).</p>
            <form onSubmit={handleCreateAcct} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input required type="text" placeholder="Name" value={acctName} onChange={e => setAcctName(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                <input required type="email" placeholder="Email" value={acctEmail} onChange={e => setAcctEmail(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                <input required type="text" placeholder="Password" value={acctPassword} onChange={e => setAcctPassword(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                <select value={acctRole} onChange={e => setAcctRole(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="VIEWER">Viewer (Read-only)</option>
                  <option value="CO_ADMIN">Co-Admin (Full access)</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={creatingAcct} className="flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {creatingAcct ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                </button>
                {acctMsg && <span className="text-xs text-emerald-400">{acctMsg}</span>}
              </div>
            </form>
          </div>

          {/* Existing Accounts with Online Status */}
          <div className="rounded-2xl border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
            <h2 className="flex items-center text-lg font-medium text-white mb-4"><Key className="mr-2 h-5 w-5 text-primary" /> Accounts</h2>
            <div className="space-y-2">
              {accounts.map(a => {
                const online = isUserOnline(a.id);
                return (
                  <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-3">
                      {/* Avatar with online/offline dot */}
                      <div className="relative">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${a.role === 'ADMIN' ? 'bg-primary/20' : a.role === 'CO_ADMIN' ? 'bg-amber-500/20' : 'bg-zinc-700'}`}>
                          {a.role === 'ADMIN' ? <Shield className="h-4 w-4 text-primary" /> : a.role === 'CO_ADMIN' ? <Shield className="h-4 w-4 text-amber-400" /> : <Eye className="h-4 w-4 text-zinc-400" />}
                        </div>
                        {/* Online/offline indicator */}
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{a.name || a.email}</p>
                          {online && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                              <Wifi className="h-2.5 w-2.5" /> Online
                            </span>
                          )}
                          {!online && (
                            <span className="flex items-center gap-1 text-[10px] text-zinc-600 font-medium">
                              <WifiOff className="h-2.5 w-2.5" /> Offline
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">{a.email} · {a.role === 'CO_ADMIN' ? 'Co-Admin' : a.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setResetId(a.id); setResetPassword(''); }} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors" title="Reset password">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      {a.role !== 'ADMIN' && (
                        <button onClick={() => setDeleteId(a.id)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors" title="Delete account">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Reset Password</h2>
            <p className="text-sm text-zinc-400 mb-4">Enter a new password for {accounts.find(a => a.id === resetId)?.email}</p>
            <input type="text" placeholder="New password" value={resetPassword} onChange={e => setResetPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setResetId(null)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/10">Cancel</button>
              <button onClick={handleResetPassword} disabled={resetting || !resetPassword} className="flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl text-center">
            <Trash2 className="mx-auto h-10 w-10 text-rose-400 mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Delete Account?</h2>
            <p className="text-sm text-zinc-400 mb-6">This will permanently remove the account for {accounts.find(a => a.id === deleteId)?.email}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/10">Cancel</button>
              <button onClick={() => handleDeleteAcct(deleteId)} className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
