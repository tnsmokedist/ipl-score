'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Users, Loader2, CheckCircle2, XCircle, Pencil, Trash2 } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  is_active: boolean;
  default_bet_amount: number;
  total_winnings: number;
  total_losses: number;
  net_balance: number;
}

export default function PlayersPage() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create modal
  const [isModalOpen, setModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newBetAmount, setNewBetAmount] = useState(100);
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [isEditOpen, setEditOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editBet, setEditBet] = useState(100);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlayers = async () => {
    try {
      const data = await api.get('/api/players');
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setCreating(true);
    try {
      await api.post('/api/players', { name: newPlayerName, default_bet_amount: Number(newBetAmount) });
      setModalOpen(false);
      setNewPlayerName('');
      setNewBetAmount(100);
      fetchPlayers();
    } catch (error) {
      console.error('Failed to create player:', error);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (player: Player) => {
    setEditPlayer(player);
    setEditName(player.name);
    setEditBet(player.default_bet_amount);
    setEditActive(player.is_active);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlayer) return;
    setSaving(true);
    try {
      await api.put(`/api/players/${editPlayer.id}`, { name: editName, default_bet_amount: Number(editBet), is_active: editActive });
      setEditOpen(false);
      fetchPlayers();
    } catch (error) {
      console.error('Failed to update player:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/api/players/${id}`);
      setDeleteConfirm(null);
      fetchPlayers();
    } catch (error) {
      console.error('Failed to delete player:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1">
            <Users className="mr-3 text-primary h-6 w-6" />
            Registry
          </h1>
          <p className="text-sm text-zinc-400">
            Manage all active betting participants on the platform.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            <Plus className="mr-2 h-4 w-4" />
            Register Player
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-white/5 bg-black/20 backdrop-blur-xl">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Pref. Bet</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Net Balance</th>
                {isAdmin && <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-transparent">
              {players.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No players registered yet.
                  </td>
                </tr>
              ) : (
                players.map((player) => (
                  <tr key={player.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{player.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2 py-1 text-xs font-medium text-zinc-400 border border-zinc-500/20">
                          <XCircle className="mr-1 h-3 w-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">${player.default_bet_amount}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${player.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {player.net_balance >= 0 ? '+' : ''}${player.net_balance}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(player)}
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                            title="Edit player"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(player.id)}
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                            title="Remove player"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
             <h2 className="text-xl font-bold text-white mb-4">Register New Player</h2>
             <form onSubmit={handleCreatePlayer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Player Name</label>
                  <input required type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-white placeholder-zinc-500 transition focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="E.g., John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Default Bet Amount ($)</label>
                  <input required type="number" min="1" value={newBetAmount} onChange={(e) => setNewBetAmount(Number(e.target.value))}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-white transition focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10">Cancel</button>
                  <button type="submit" disabled={creating} className="flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-70">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && editPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
             <h2 className="text-xl font-bold text-white mb-4">Edit Player</h2>
             <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Player Name</label>
                  <input required type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-white placeholder-zinc-500 transition focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Default Bet Amount ($)</label>
                  <input required type="number" min="1" value={editBet} onChange={(e) => setEditBet(Number(e.target.value))}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-white transition focus:border-primary focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditActive(true)}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${editActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'}`}>
                      Active
                    </button>
                    <button type="button" onClick={() => setEditActive(false)}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${!editActive ? 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30' : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'}`}>
                      Inactive
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditOpen(false)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10">Cancel</button>
                  <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-70">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl text-center">
            <Trash2 className="mx-auto h-10 w-10 text-rose-400 mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Remove Player?</h2>
            <p className="text-sm text-zinc-400 mb-6">This action cannot be undone. All draw history for this player will also be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-rose-700 disabled:opacity-70">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
