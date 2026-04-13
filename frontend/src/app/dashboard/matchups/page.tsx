'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Swords, Plus, Timer, History, PlayCircle, Loader2 } from 'lucide-react';

export default function MatchupsPage() {
  const [matchups, setMatchups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [supportData, setSupportData] = useState<any>({ matches: [], cricketPlayers: [], bettingPlayers: [] });
  const [isModalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMatchup, setNewMatchup] = useState<any>({ match_id: '', betting_player_id: '', player_a_id: '', player_b_id: '', assigned_player_id: '', bet_amount: 100 });

  const fetchData = async () => {
    try {
      const ms = await api.get('/api/matchups');
      setMatchups(ms);
      
      const sd = await api.get('/api/matchups/support-data');
      const bp = await api.get('/api/players');
      setSupportData({
        matches: sd.matches,
        cricketPlayers: sd.cricketPlayers,
        bettingPlayers: bp
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/matchups', newMatchup);
      setModalOpen(false);
      fetchData();
    } catch (e) {
      console.error('Failed to create', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1">
            <Swords className="mr-3 text-primary h-6 w-6" />
            Matchup Engine
          </h1>
          <p className="text-sm text-zinc-400">
            Create and monitor custom player-vs-player betting logic.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Matchup
        </button>
      </div>

      <div className="flex w-full items-center gap-2 border-b border-white/10 pb-4">
        <button className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white">
          <PlayCircle className="h-4 w-4" /> Active
        </button>
        <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white">
          <Timer className="h-4 w-4" /> Pending
        </button>
        <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white">
          <History className="h-4 w-4" /> Settled
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-white/5 bg-black/20 backdrop-blur-xl">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : matchups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-12 text-center backdrop-blur-xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Swords className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No active matchups</h3>
          <p className="mb-6 max-w-sm text-sm text-zinc-400">
            Click Create Matchup above to start generating active bet comparisons. If you haven't yet, go to settings and hit Sync Mock Data to populate the environment first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matchups.map(m => (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">{m.status}</span>
                <span className="text-sm font-bold text-emerald-400">${m.bet_amount}</span>
              </div>
              <div className="text-sm font-medium text-zinc-500 mb-2 truncate">
                {m.match?.team_a_name} vs {m.match?.team_b_name}
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-4">
                <div className={`text-sm ${m.assigned_player_id === m.player_a_id ? 'text-white font-bold' : 'text-zinc-400'}`}>
                  {m.player_a?.name}
                </div>
                <span className="text-zinc-600 text-xs px-2">VS</span>
                <div className={`text-sm ${m.assigned_player_id === m.player_b_id ? 'text-white font-bold' : 'text-zinc-400'}`}>
                  {m.player_b?.name}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5">
                <p className="text-xs text-zinc-500">Placed by <span className="text-white">{m.betting_player?.name}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <h2 className="text-xl font-bold text-white mb-4">Create Matchup</h2>
             
             {supportData.matches.length === 0 ? (
               <div className="text-amber-400 text-sm p-4 bg-amber-400/10 rounded-lg">
                 You must go to Settings and click Sync Mock Data before you can create a matchup.
               </div>
             ) : (
               <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="block text-sm font-medium text-zinc-400 mb-1">IPL Match</label>
                       <select required className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white" value={newMatchup.match_id} onChange={e => setNewMatchup({...newMatchup, match_id: e.target.value})}>
                          <option value="">Select a Match</option>
                          {supportData.matches.map((m: any) => <option key={m.id} value={m.id}>{m.team_a_name} vs {m.team_b_name}</option>)}
                       </select>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-sm font-medium text-zinc-400 mb-1">Betting Player</label>
                       <select required className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white" value={newMatchup.betting_player_id} onChange={e => setNewMatchup({...newMatchup, betting_player_id: e.target.value})}>
                          <option value="">Select Bettor</option>
                          {supportData.bettingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-zinc-400 mb-1">Player A</label>
                       <select required className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white" value={newMatchup.player_a_id} onChange={e => setNewMatchup({...newMatchup, player_a_id: e.target.value, assigned_player_id: e.target.value})}>
                          <option value="">Select</option>
                          {supportData.cricketPlayers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-zinc-400 mb-1">Player B</label>
                       <select required className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white" value={newMatchup.player_b_id} onChange={e => setNewMatchup({...newMatchup, player_b_id: e.target.value})}>
                          <option value="">Select</option>
                          {supportData.cricketPlayers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-sm font-medium text-zinc-400 mb-1">Bet Amount ($)</label>
                       <input type="number" required min="1" className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-white" value={newMatchup.bet_amount} onChange={e => setNewMatchup({...newMatchup, bet_amount: e.target.value})} />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10">Cancel</button>
                    <button type="submit" disabled={creating} className="flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90">
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                    </button>
                  </div>
               </form>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
