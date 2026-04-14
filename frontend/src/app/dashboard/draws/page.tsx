'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Dices, Plus, Loader2, Trophy, Hash, ChevronRight, Calendar, Zap, Pencil } from 'lucide-react';

export default function DrawsPage() {
  const { isAdmin } = useAuth();
  const [weeks, setWeeks] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected week detail
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [matchResults, setMatchResults] = useState<any[]>([]);

  // Create/Edit draw modal
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditMode, setEditMode] = useState(false);
  const [editWeekId, setEditWeekId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Score modal
  const [isScoreOpen, setScoreOpen] = useState(false);
  const [scoreMatch, setScoreMatch] = useState<any>(null);
  const [scoreEntries, setScoreEntries] = useState<any[]>([]);
  const [settling, setSettling] = useState(false);

  // Auto-fetch
  const [fetching, setFetching] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [w, p] = await Promise.all([api.get('/api/draws/weeks'), api.get('/api/players')]);
      setWeeks(w);
      setPlayers(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadWeekDetail = async (weekId: string) => {
    try {
      const detail = await api.get(`/api/draws/weeks/${weekId}`);
      setSelectedWeek(detail);
      setSelectedMatch('');
      setMatchResults([]);
    } catch (e) { console.error(e); }
  };

  const loadMatchResults = async (matchId: string) => {
    setSelectedMatch(matchId);
    try {
      const results = await api.get(`/api/draws/match/${matchId}`);
      setMatchResults(results);
    } catch (e) { console.error(e); }
  };

  // Create weekly draw
  const openCreate = () => {
    const today = new Date();
    // Find most recent Wednesday (week starts Wed 12:00 AM)
    const wed = new Date(today);
    const dayOfWeek = today.getDay(); // 0=Sun,1=Mon,...,3=Wed
    const daysSinceWed = (dayOfWeek + 4) % 7; // days since last Wed
    wed.setDate(today.getDate() - daysSinceWed);
    // Week ends next Tuesday 11:59 PM
    const tue = new Date(wed);
    tue.setDate(wed.getDate() + 6);
    setNewStart(wed.toISOString().split('T')[0]);
    setNewEnd(tue.toISOString().split('T')[0]);
    setNewLabel(`${wed.toLocaleDateString('en-US', {month:'short',day:'numeric'})} – ${tue.toLocaleDateString('en-US', {month:'short',day:'numeric'})}`);
    setAssignments(players.map(p => ({ betting_player_id: p.id, name: p.name, team_a_position: 1, team_b_position: 1 })));
    setEditMode(false);
    setEditWeekId(null);
    setCreateOpen(true);
  };

  // Edit existing weekly draw
  const openEdit = (week: any) => {
    setNewLabel(week.week_label);
    setNewStart(new Date(week.week_start).toISOString().split('T')[0]);
    setNewEnd(new Date(week.week_end).toISOString().split('T')[0]);
    // Populate assignments from existing entries
    const existingAssignments = (week.entries || []).map((e: any) => ({
      betting_player_id: e.betting_player_id,
      name: e.betting_player?.name || '',
      team_a_position: e.team_a_position,
      team_b_position: e.team_b_position,
    }));
    // Add any players not yet in the draw
    const existingIds = existingAssignments.map((a: any) => a.betting_player_id);
    const missingPlayers = players.filter(p => !existingIds.includes(p.id)).map(p => ({
      betting_player_id: p.id,
      name: p.name,
      team_a_position: 1,
      team_b_position: 1,
    }));
    setAssignments([...existingAssignments, ...missingPlayers]);
    setEditMode(true);
    setEditWeekId(week.id);
    setCreateOpen(true);
  };

  const saveDraw = async () => {
    setSaving(true);
    try {
      // Dates from <input type="date"> are YYYY-MM-DD strings in local time
      // Construct proper dates: Wed 12:00 AM local, Tue 11:59 PM local
      const startParts = newStart.split('-').map(Number);
      const endParts = newEnd.split('-').map(Number);
      const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0);
      const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59);

      const payload = {
        week_label: newLabel,
        week_start: startDate.toISOString(),
        week_end: endDate.toISOString(),
        assignments: assignments.map(a => ({ betting_player_id: a.betting_player_id, team_a_position: a.team_a_position, team_b_position: a.team_b_position }))
      };

      if (isEditMode && editWeekId) {
        await api.put(`/api/draws/weeks/${editWeekId}`, payload);
      } else {
        await api.post('/api/draws/weeks', payload);
      }

      setCreateOpen(false);
      setEditMode(false);
      setEditWeekId(null);
      await fetchData();
      // Refresh selected week if we were editing it
      if (isEditMode && editWeekId) {
        await loadWeekDetail(editWeekId);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // Score entry
  const openScoreModal = (match: any) => {
    setScoreMatch(match);
    const matchRes = selectedWeek?.results?.filter((r: any) => r.match_id === match.id) || [];
    setScoreEntries(matchRes.map((r: any) => ({
      result_id: r.id, betting_player_name: r.betting_player?.name,
      team_a_position: r.team_a_position, team_b_position: r.team_b_position,
      player_a_name: r.player_a_name || '', player_b_name: r.player_b_name || '',
      player_a_runs: r.player_a_runs || 0, player_b_runs: r.player_b_runs || 0
    })));
    setScoreOpen(true);
  };

  const settleScores = async () => {
    if (!scoreMatch) return;
    setSettling(true);
    try {
      await api.put(`/api/draws/match/${scoreMatch.id}/scores`, { scores: scoreEntries });
      setScoreOpen(false);
      if (selectedWeek) await loadWeekDetail(selectedWeek.id);
      await loadMatchResults(scoreMatch.id);
    } catch (e) { console.error(e); }
    finally { setSettling(false); }
  };

  const autoFetchScores = async (matchId: string) => {
    setFetching(matchId);
    try {
      const res = await api.post(`/api/draws/match/${matchId}/auto-fetch`, {});
      alert(res.message || 'Scores fetched and settled!');
      if (selectedWeek) await loadWeekDetail(selectedWeek.id);
      await loadMatchResults(matchId);
    } catch (e: any) {
      alert(e.message || 'Auto-fetch failed. Try manual entry.');
    }
    finally { setFetching(null); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="relative"><Loader2 className="h-8 w-8 animate-spin text-primary" /><div className="absolute inset-0 blur-xl opacity-30 bg-primary rounded-full" /></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1"><Dices className="mr-3 text-primary h-6 w-6" /> Weekly Draws</h1>
          <p className="text-sm text-zinc-500">Draw positions are set on Tuesday and apply Wed 12AM – Tue 11:59PM.</p>
        </div>
        {isAdmin && <button onClick={openCreate} className="flex items-center justify-center rounded-xl btn-primary px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-2 h-4 w-4" /> New Weekly Draw</button>}
      </div>

      {/* Week Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weeks.map(w => (
          <div key={w.id} className={`relative group cursor-pointer rounded-2xl p-5 transition-premium ${selectedWeek?.id === w.id ? 'card-elevated border border-primary/30 glow-blue' : 'card-glass hover:border-white/12'}`}>
            {/* Edit button */}
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(w); }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-primary transition-all z-10"
                title="Edit draw"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <div onClick={() => loadWeekDetail(w.id)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">{w.week_label}</span>
                <Calendar className="h-4 w-4 text-zinc-600" />
              </div>
              <p className="text-xs text-zinc-500">{w.entries?.length || 0} players · {w._count?.results || 0} match entries</p>
              <div className="pitch-line mt-3 mb-3 rounded-full" />
              <div className="flex flex-wrap gap-1.5">
                {w.entries?.map((e: any) => (
                  <span key={e.id} className="text-[11px] bg-white/4 border border-white/8 px-2 py-0.5 rounded-md font-mono text-zinc-400 score-display">{e.betting_player?.name?.slice(0,3)}: A{e.team_a_position}B{e.team_b_position}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {weeks.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 card-glass p-12 text-center">
            <Dices className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No weekly draws yet. Click "New Weekly Draw" to create one.</p>
          </div>
        )}
      </div>

      {/* Selected Week — Matches for this week */}
      {selectedWeek && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Matches — {selectedWeek.week_label}</h2>
            {isAdmin && (
              <button
                onClick={() => openEdit(selectedWeek)}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/8 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-primary transition-all"
              >
                <Pencil className="h-3 w-3" />
                Edit Draw
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(selectedWeek.matches || []).map((m: any) => {
              const isCompleted = m.status === 'COMPLETED';
              const hasResults = selectedWeek.results?.some((r: any) => r.match_id === m.id && r.total_runs > 0);
              // Find winners for this match
              const winners = isCompleted ? (selectedWeek.results || []).filter((r: any) => r.match_id === m.id && r.is_winner).map((r: any) => r.betting_player?.name).filter(Boolean) : [];
              return (
                <div key={m.id} onClick={() => loadMatchResults(m.id)} className={`cursor-pointer rounded-xl p-4 transition-premium ${selectedMatch === m.id ? 'card-elevated border border-primary/30' : 'card-glass hover:border-white/12'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-md tracking-wider ${isCompleted ? 'badge-settled' : 'badge-pending'}`}>{isCompleted ? 'Settled' : 'Pending'}</span>
                      {winners.length > 0 && (
                        <span className="text-xs font-semibold text-amber-300/90">🏆 {winners.join(', ')}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-600 score-display">{new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <p className="text-sm text-white font-medium truncate">{m.team_a_name} <span className="text-zinc-600">vs</span> {m.team_b_name}</p>
                  <div className="flex gap-2 mt-3">
                    {isAdmin && !isCompleted && (
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); autoFetchScores(m.id); }}
                          disabled={fetching === m.id}
                          className="flex items-center rounded-lg bg-blue-500/8 border border-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/15 hover:border-blue-500/25 disabled:opacity-50 transition-premium">
                          {fetching === m.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />} Auto-Fetch
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openScoreModal(m); }}
                          className="flex items-center rounded-lg bg-emerald-500/8 border border-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/25 transition-premium">
                          <Hash className="mr-1 h-3 w-3" /> Manual
                        </button>
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); loadMatchResults(m.id); }}
                      className="flex items-center rounded-lg bg-white/4 border border-white/6 px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/8 hover:text-zinc-300 transition-premium">
                      <ChevronRight className="mr-1 h-3 w-3" /> View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match Results Table */}
      {selectedMatch && matchResults.length > 0 && (
        <div className="rounded-2xl card-glass overflow-hidden"><div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-lg font-bold text-white">
              {matchResults[0]?.match?.team_a_name} <span className="text-zinc-600 font-normal">vs</span> {matchResults[0]?.match?.team_b_name}
            </h2>
          </div>
          <table className="min-w-full divide-y divide-white/5">
            <thead>
              <tr className="bg-white/3">
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Player</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Draw</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">A Player</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">B Player</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">A Runs</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">B Runs</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Total</th>
                <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {matchResults.map(r => (
                <tr key={r.id} className={`transition-premium ${r.is_winner ? 'bg-emerald-500/6' : 'hover:bg-white/3'}`}>
                  <td className="px-6 py-4 text-sm font-semibold text-white">{r.betting_player?.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400 score-display">A{r.team_a_position}B{r.team_b_position}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.player_a_name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.player_b_name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300 score-display">{r.player_a_runs}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300 score-display">{r.player_b_runs}</td>
                  <td className="px-6 py-4 text-sm font-bold text-white score-display">{r.total_runs}</td>
                  <td className="px-6 py-4">{r.is_winner ? <span className="inline-flex items-center gap-1 text-xs font-bold badge-settled px-2.5 py-1 rounded-md"><Trophy className="h-3 w-3" /> ${r.payout}</span> : r.total_runs > 0 ? <span className="text-xs text-zinc-600">—</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {/* Create / Edit Weekly Draw Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl card-glass p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">
              {isEditMode ? 'Edit Weekly Draw' : 'New Weekly Draw'}
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              {isEditMode 
                ? 'Update positions for this week. Only pending (unsettled) matches will be affected.'
                : 'Assign batting positions for the entire week. Same positions apply to all matches.'}
            </p>
            {isEditMode && (
              <div className="flex items-center gap-2 mb-4 rounded-xl bg-amber-500/8 border border-amber-500/15 px-3 py-2">
                <Pencil className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">Editing mode — settled matches will not be changed.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Label</label>
                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Week Start (Wed)</label>
                <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Week End (Tue)</label>
                <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="space-y-3">
              {assignments.map((a, i) => (
                <div key={a.betting_player_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl bg-white/5 p-3 border border-white/5">
                  <span className="text-sm font-medium text-white w-20 shrink-0">{a.name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-zinc-500">A</span>
                    <select value={a.team_a_position} onChange={e => { const u = [...assignments]; u[i].team_a_position = Number(e.target.value); setAssignments(u); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white min-w-[52px]">
                      {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-xs text-zinc-500">B</span>
                    <select value={a.team_b_position} onChange={e => { const u = [...assignments]; u[i].team_b_position = Number(e.target.value); setAssignments(u); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white min-w-[52px]">
                      {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-xs text-zinc-400 font-mono ml-2">A{a.team_a_position}B{a.team_b_position}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-6">
              <button onClick={() => { setCreateOpen(false); setEditMode(false); setEditWeekId(null); }} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 border border-white/8 hover:bg-white/5 transition-premium">Cancel</button>
              <button onClick={saveDraw} disabled={saving} className="flex flex-1 items-center justify-center rounded-xl btn-primary px-4 py-2.5 text-sm font-semibold text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditMode ? 'Update Draw' : 'Save Draw for Week'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      {isScoreOpen && scoreMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl card-glass p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Enter Scores & Settle</h2>
            <p className="text-sm text-zinc-400 mb-6">{scoreMatch.team_a_name} vs {scoreMatch.team_b_name} — {new Date(scoreMatch.date).toLocaleDateString()}</p>
            <div className="space-y-3">
              {scoreEntries.map((s, i) => (
                <div key={s.result_id} className="rounded-xl bg-white/5 p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">{s.betting_player_name}</span>
                    <span className="text-xs text-zinc-400 font-mono">A{s.team_a_position}B{s.team_b_position}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">A{s.team_a_position} Player</label>
                      <input type="text" value={s.player_a_name} onChange={e => { const u = [...scoreEntries]; u[i].player_a_name = e.target.value; setScoreEntries(u); }} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Player name" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">A{s.team_a_position} Runs</label>
                      <input type="number" min="0" value={s.player_a_runs} onChange={e => { const u = [...scoreEntries]; u[i].player_a_runs = Number(e.target.value); setScoreEntries(u); }} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">B{s.team_b_position} Player</label>
                      <input type="text" value={s.player_b_name} onChange={e => { const u = [...scoreEntries]; u[i].player_b_name = e.target.value; setScoreEntries(u); }} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Player name" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">B{s.team_b_position} Runs</label>
                      <input type="number" min="0" value={s.player_b_runs} onChange={e => { const u = [...scoreEntries]; u[i].player_b_runs = Number(e.target.value); setScoreEntries(u); }} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-6">
              <button onClick={() => setScoreOpen(false)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 border border-white/8 hover:bg-white/5 transition-premium">Cancel</button>
              <button onClick={settleScores} disabled={settling} className="flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 border border-emerald-500/30 shadow-lg shadow-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-white hover:from-emerald-500 hover:to-emerald-400 transition-premium">
                {settling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Settle Match'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
