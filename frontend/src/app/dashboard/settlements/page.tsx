'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Loader2, TrendingUp, TrendingDown, Trophy, ChevronDown, ChevronUp, BadgeCheck, FileDown, Edit3, Check, X } from 'lucide-react';

export default function SettlementsPage() {
  const [data, setData] = useState<any>({ weeks: [], players: [] });
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [editPayout, setEditPayout] = useState('');
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => { fetchSettlement(); }, []);

  const fetchSettlement = async () => {
    try {
      const d = await api.get('/api/draws/settlement');
      setData(d);
      if (d.weeks?.length > 0) setExpandedWeek(d.weeks[0].week_id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const confirmPlayerPayout = async (weekId: string, playerId: string) => {
    setConfirming(`${weekId}_${playerId}`);
    try {
      await api.put(`/api/draws/confirm-player-payout/${weekId}/${playerId}`, {});
      await fetchSettlement();
    } catch (e) { console.error(e); }
    finally { setConfirming(null); }
  };

  const unconfirmPlayerPayout = async (weekId: string, playerId: string) => {
    setConfirming(`${weekId}_${playerId}`);
    try {
      await api.put(`/api/draws/unconfirm-player-payout/${weekId}/${playerId}`, {});
      await fetchSettlement();
    } catch (e) { console.error(e); }
    finally { setConfirming(null); }
  };

  const handleEditSave = async (resultId: string) => {
    setSaving(true);
    try {
      const payoutVal = parseFloat(editPayout);
      if (isNaN(payoutVal) || payoutVal < 0) { alert('Enter a valid payout amount'); setSaving(false); return; }
      await api.put(`/api/draws/settlement/${resultId}`, { payout: payoutVal, is_winner: payoutVal > 0 });
      setEditingResult(null);
      setEditPayout('');
      await fetchSettlement();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // ─── Export Week Report as PDF ───
  const exportWeekPDF = async (week: any) => {
    const { jsPDF } = await import('jspdf');
    const { autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // ─── Title Banner ───
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('IPL Betting – Weekly Settlement Report', 14, 18);
    doc.setFontSize(12);
    doc.setTextColor(148, 163, 184);
    doc.text(`Week: ${week.week_label}  |  ${week.total_matches} matches settled  |  ${week.payout_confirmed ? '✓ Payout Confirmed' : '⏳ Payout Pending'}`, 14, 28);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`, 14, 35);

    let y = 48;

    // ─── Per-Player Weekly Settlement ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Per-Player Weekly Settlement', 14, y);
    y += 2;

    const summaryRows = (week.player_summaries || []).map((ps: any) => [
      ps.player_name,
      `${ps.matches_played}`,
      `${ps.wins}`,
      `$${ps.total_won}`,
      `$${ps.total_paid}`,
      `${ps.weekly_net >= 0 ? '+' : ''}$${ps.weekly_net}`
    ]);

    const totalPot = week.player_summaries?.reduce((s: number, ps: any) => s + ps.total_paid, 0) || 0;
    const totalWon = week.player_summaries?.reduce((s: number, ps: any) => s + ps.total_won, 0) || 0;

    autoTable(doc, {
      startY: y,
      head: [['Player', 'Matches', 'Wins', 'Won', 'Paid', 'Weekly Net']],
      body: summaryRows,
      foot: [['TOTAL', '', '', `$${totalWon}`, `$${totalPot}`, '']],
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        5: { fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) { data.cell.styles.textColor = [5, 150, 105]; }
          else if (val.startsWith('-')) { data.cell.styles.textColor = [220, 38, 38]; }
        }
      },
      margin: { left: 14, right: 14 },
      theme: 'striped'
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ─── Match Results Detail ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Match Results – Player Scores', 14, y);
    y += 2;

    const detailRows: any[] = [];
    (week.player_summaries || []).forEach((ps: any) => {
      (ps.results || []).forEach((r: any) => {
        const matchLabel = `${r.match?.team_a_name || '?'} vs ${r.match?.team_b_name || '?'}`;
        const matchDate = r.match?.date ? new Date(r.match.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '';
        const betAmt = r.match?.bet_amount || 100;
        const net = r.is_winner ? `+$${r.payout - betAmt}` : r.total_runs > 0 ? `-$${betAmt}` : '—';
        detailRows.push([
          ps.player_name, matchDate, matchLabel,
          `${r.player_a_name || '—'}`, r.player_a_runs ?? '',
          `${r.player_b_name || '—'}`, r.player_b_runs ?? '',
          r.total_runs || '', net, r.is_winner ? '⭐' : ''
        ]);
      });
    });

    autoTable(doc, {
      startY: y,
      head: [['Player', 'Date', 'Match', 'Batter A', 'A Runs', 'Batter B', 'B Runs', 'Total', 'Net', 'Win']],
      body: detailRows,
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 22 }, 1: { cellWidth: 24 }, 2: { cellWidth: 55 },
        3: { cellWidth: 30 }, 4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 30 }, 6: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        9: { cellWidth: 12, halign: 'center' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && (data.column.index === 4 || data.column.index === 6)) {
          data.cell.styles.textColor = [30, 64, 175];
        }
        if (data.section === 'body' && data.column.index === 7) {
          data.cell.styles.textColor = [15, 23, 42]; data.cell.styles.fontStyle = 'bold';
        }
        if (data.section === 'body' && data.column.index === 8) {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) { data.cell.styles.textColor = [5, 150, 105]; }
          else if (val.startsWith('-')) { data.cell.styles.textColor = [220, 38, 38]; }
        }
      },
      margin: { left: 14, right: 14 },
      theme: 'striped'
    });

    // ─── Footer ───
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`IPL Betting Platform – ${week.week_label} – Page ${i}/${pageCount}`, 14, doc.internal.pageSize.getHeight() - 8);
      doc.text('All Star Group', pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`IPL_Settlement_${week.week_label.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1"><DollarSign className="mr-3 text-primary h-6 w-6" /> Settlements</h1>
        <p className="text-sm text-zinc-400">Weekly per-player settlement — see exactly what each player owes or gains.</p>
      </div>

      {/* Overall Leaderboard */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(data.players || []).map((p: any, i: number) => (
          <div key={p.id} className={`rounded-2xl border p-5 backdrop-blur-xl ${i === 0 && p.net_balance > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-black/40'}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-xs text-zinc-500">Overall</p>
              </div>
              {i === 0 && p.net_balance > 0 && <Trophy className="h-5 w-5 text-amber-400" />}
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              {p.net_balance >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400 mr-1" /> : <TrendingDown className="h-4 w-4 text-rose-400 mr-1" />}
              <span className={`text-2xl font-bold ${p.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.net_balance >= 0 ? '+' : ''}${p.net_balance}</span>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-zinc-500">
              <span>Won: <span className="text-emerald-400">${p.total_winnings}</span></span>
              <span>Paid: <span className="text-rose-400">${p.total_losses}</span></span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Breakdowns */}
      {(data.weeks || []).map((week: any) => {
        const isExpanded = expandedWeek === week.week_id;
        const totalPot = week.player_summaries?.reduce((sum: number, ps: any) => sum + ps.total_paid, 0) || 0;
        const totalWon = week.player_summaries?.reduce((sum: number, ps: any) => sum + ps.total_won, 0) || 0;
        return (
          <div key={week.week_id} className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
            {/* Week Header */}
            <button onClick={() => setExpandedWeek(isExpanded ? null : week.week_id)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    {week.week_label}
                    {week.payout_confirmed 
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"><BadgeCheck className="h-3 w-3" /> All Paid</span>
                      : (() => {
                          const paidCount = week.player_summaries?.filter((ps: any) => ps.paid).length || 0;
                          const totalCount = week.player_summaries?.length || 0;
                          return paidCount > 0 ? <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{paidCount}/{totalCount} Paid</span> : null;
                        })()
                    }
                  </h3>
                  <p className="text-xs text-zinc-500">{week.total_matches} match(es) · Total pot: ${totalPot} · Paid out: ${totalWon}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
            </button>

            {isExpanded && (
              <div className="border-t border-white/5">
                {/* ★ Per-Player Weekly Settlement Cards — THE KEY FEATURE ★ */}
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-3">Per-Player Settlement This Week <span className="text-zinc-600 normal-case tracking-normal">— tap a player to see match details</span></p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {week.player_summaries?.map((ps: any) => {
                      const playerKey = `${week.week_id}_${ps.player_id}`;
                      const isPlayerExpanded = expandedPlayer === playerKey;
                      return (
                        <div key={ps.player_id} className="col-span-1">
                          <button onClick={() => setExpandedPlayer(isPlayerExpanded ? null : playerKey)}
                            className={`w-full text-left rounded-xl p-4 border transition-all hover:scale-[1.02] cursor-pointer ${
                              isPlayerExpanded ? 'ring-2 ring-primary/40 border-primary/30 bg-primary/5' :
                              ps.weekly_net > 0 ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40' : 
                              ps.weekly_net < 0 ? 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40' : 
                              'border-white/5 bg-white/5 hover:border-white/10'
                            }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-white">{ps.player_name}</p>
                                {ps.paid && <BadgeCheck className="h-4 w-4 text-emerald-400" />}
                              </div>
                              {isPlayerExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                            </div>
                            <p className={`text-2xl font-bold ${ps.weekly_net > 0 ? 'text-emerald-400' : ps.weekly_net < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                              {ps.weekly_net >= 0 ? '+' : ''}${ps.weekly_net}
                            </p>
                            <div className="flex gap-3 mt-2 text-xs text-zinc-500">
                              <span>{ps.wins}W / {ps.matches_played}M</span>
                              <span>Won: <span className="text-emerald-400">${ps.total_won}</span></span>
                              <span>Paid: <span className="text-rose-400">${ps.total_paid}</span></span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <div className={`text-xs font-medium px-2 py-1 rounded-lg inline-block ${
                                ps.weekly_net > 0 ? 'bg-emerald-500/10 text-emerald-400' : 
                                ps.weekly_net < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-500/10 text-zinc-400'
                              }`}>
                                {ps.weekly_net > 0 ? `Collects $${ps.weekly_net}` : ps.weekly_net < 0 ? `Owes $${Math.abs(ps.weekly_net)}` : 'Even'}
                              </div>
                              {ps.paid 
                                ? <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">✓ Settled</span>
                                : <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">Unpaid</span>
                              }
                            </div>
                          </button>

                          {/* Expanded: Individual match results for this player */}
                          {isPlayerExpanded && (
                            <div className="mt-2 rounded-xl border border-white/5 bg-black/30 overflow-hidden">
                              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                                <table className="min-w-full divide-y divide-white/5">
                                  <thead>
                                    <tr className="bg-white/5">
                                      <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400">Match</th>
                                      <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400">A</th>
                                      <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400">B</th>
                                      <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400">Total</th>
                                      <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400">Payout</th>
                                      <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400">Net</th>
                                      {isAdmin && <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-zinc-400"></th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {ps.results.map((r: any) => {
                                      const betAmt = r.match?.bet_amount || 100;
                                      const isEditing = editingResult === r.id;
                                      return (
                                        <tr key={r.id} className={r.is_winner ? 'bg-emerald-500/5' : 'hover:bg-white/5'}>
                                          <td className="px-3 py-1.5 text-xs text-zinc-400 truncate max-w-[140px]">{r.match?.team_a_name} vs {r.match?.team_b_name}</td>
                                          <td className="px-3 py-1.5">
                                            <div className="text-xs text-zinc-400">{r.player_a_name || '—'}</div>
                                            <div className="text-sm font-bold text-blue-400">{r.player_a_runs}</div>
                                          </td>
                                          <td className="px-3 py-1.5">
                                            <div className="text-xs text-zinc-400">{r.player_b_name || '—'}</div>
                                            <div className="text-sm font-bold text-blue-400">{r.player_b_runs}</div>
                                          </td>
                                          <td className="px-3 py-1.5 text-sm font-bold text-white">{r.total_runs}</td>
                                          <td className="px-3 py-1.5">
                                            {isEditing ? (
                                              <input type="number" value={editPayout} onChange={e => setEditPayout(e.target.value)}
                                                className="w-16 rounded-lg border border-primary/30 bg-white/5 px-2 py-1 text-xs text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                                autoFocus />
                                            ) : (
                                              <span className="text-xs text-zinc-300">${r.payout}</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-1.5">
                                            {r.is_winner ? (
                                              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">+${r.payout - betAmt}</span>
                                            ) : r.total_runs > 0 ? (
                                              <span className="text-xs text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">-${betAmt}</span>
                                            ) : <span className="text-xs text-zinc-600">—</span>}
                                          </td>
                                          {isAdmin && (
                                            <td className="px-3 py-1.5">
                                              {isEditing ? (
                                                <div className="flex items-center gap-0.5">
                                                  <button onClick={() => handleEditSave(r.id)} disabled={saving}
                                                    className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                  </button>
                                                  <button onClick={() => { setEditingResult(null); setEditPayout(''); }}
                                                    className="rounded p-1 text-zinc-400 hover:bg-white/10 transition-colors">
                                                    <X className="h-3.5 w-3.5" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <button onClick={() => { setEditingResult(r.id); setEditPayout(String(r.payout)); }}
                                                  className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white transition-colors">
                                                  <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payout Actions — Per-Player Confirm */}
                <div className="mx-4 mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Payment Status</p>
                      <div className="flex flex-wrap gap-4 mt-1 text-xs">
                        <span className="text-zinc-400">{week.total_matches} matches · Pot: <span className="text-white font-medium">${totalPot}</span></span>
                        {(() => {
                          const paidCount = week.player_summaries?.filter((ps: any) => ps.paid).length || 0;
                          const totalCount = week.player_summaries?.length || 0;
                          const unpaidCount = totalCount - paidCount;
                          return (
                            <>
                              <span className="text-emerald-400 font-medium">{paidCount} paid</span>
                              {unpaidCount > 0 && <span className="text-amber-400 font-medium">{unpaidCount} unpaid</span>}
                              {unpaidCount === 0 && totalCount > 0 && <span className="text-emerald-400 font-medium">✓ All settled!</span>}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <button onClick={() => exportWeekPDF(week)}
                      className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors shrink-0">
                      <FileDown className="h-4 w-4" />
                      Export PDF
                    </button>
                  </div>

                  {/* Per-player payment buttons */}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-white/5">
                      {week.player_summaries?.map((ps: any) => {
                        const key = `${week.week_id}_${ps.player_id}`;
                        const isConfirming = confirming === key;
                        return ps.paid ? (
                          <button key={ps.player_id} onClick={() => unconfirmPlayerPayout(week.week_id, ps.player_id)} disabled={isConfirming}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                            {isConfirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <BadgeCheck className="h-3 w-3" />}
                            {ps.player_name} ✓
                          </button>
                        ) : (
                          <button key={ps.player_id} onClick={() => confirmPlayerPayout(week.week_id, ps.player_id)} disabled={isConfirming}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                            {isConfirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                            {ps.player_name} — Mark Paid
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
