'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Loader2, TrendingUp, TrendingDown, Trophy, CheckCircle2, ChevronDown, ChevronUp, BadgeCheck, FileDown, Undo2 } from 'lucide-react';

export default function SettlementsPage() {
  const [data, setData] = useState<any>({ weeks: [], players: [] });
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
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

  const confirmWeekPayout = async (weekId: string) => {
    setConfirming(weekId);
    try {
      await api.put(`/api/draws/confirm-week-payout/${weekId}`, {});
      await fetchSettlement();
    } catch (e) { console.error(e); }
    finally { setConfirming(null); }
  };

  const unconfirmWeekPayout = async (weekId: string) => {
    setConfirming(weekId);
    try {
      await api.put(`/api/draws/unconfirm-week-payout/${weekId}`, {});
      await fetchSettlement();
    } catch (e) { console.error(e); }
    finally { setConfirming(null); }
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

    // ─── Weekly P&L Summary Table (no Record column) ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Weekly Player Summary', 14, y);
    y += 2;

    const summaryRows = (week.player_summaries || []).map((ps: any) => [
      ps.player_name,
      `${ps.wins}`,
      `$${ps.total_won}`,
      `$${ps.total_paid}`,
      `${ps.weekly_net >= 0 ? '+' : ''}$${ps.weekly_net}`
    ]);

    const totalPot = week.player_summaries?.reduce((s: number, ps: any) => s + ps.total_paid, 0) || 0;
    const totalWon = week.player_summaries?.reduce((s: number, ps: any) => s + ps.total_won, 0) || 0;

    autoTable(doc, {
      startY: y,
      head: [['Player', 'Wins', 'Won', 'Paid', 'Net P&L']],
      body: summaryRows,
      foot: [['TOTAL', '', `$${totalWon}`, `$${totalPot}`, '']],
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        4: { fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) { data.cell.styles.textColor = [5, 150, 105]; }
          else if (val.startsWith('-')) { data.cell.styles.textColor = [220, 38, 38]; }
        }
      },
      margin: { left: 14, right: 14 },
      theme: 'striped'
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ─── Match Results with Player Names & Scores ───
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
          ps.player_name,
          matchDate,
          matchLabel,
          `${r.player_a_name || '—'}`,
          r.player_a_runs ?? '',
          `${r.player_b_name || '—'}`,
          r.player_b_runs ?? '',
          r.total_runs || '',
          net,
          r.is_winner ? '⭐' : ''
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
        0: { fontStyle: 'bold', cellWidth: 22 },
        1: { cellWidth: 24 },
        2: { cellWidth: 55 },
        3: { cellWidth: 30 },
        4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 30 },
        6: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        9: { cellWidth: 12, halign: 'center' }
      },
      didParseCell: (data: any) => {
        // Color the runs columns
        if (data.section === 'body' && (data.column.index === 4 || data.column.index === 6)) {
          data.cell.styles.textColor = [30, 64, 175]; // blue for runs
        }
        // Color the total column
        if (data.section === 'body' && data.column.index === 7) {
          data.cell.styles.textColor = [15, 23, 42]; // dark for total
          data.cell.styles.fontStyle = 'bold';
        }
        // Color net P&L
        if (data.section === 'body' && data.column.index === 8) {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) { data.cell.styles.textColor = [5, 150, 105]; }
          else if (val.startsWith('-')) { data.cell.styles.textColor = [220, 38, 38]; }
        }
      },
      margin: { left: 14, right: 14 },
      theme: 'striped'
    });

    // ─── Footer on all pages ───
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
        <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1"><DollarSign className="mr-3 text-primary h-6 w-6" /> Weekly Settlement</h1>
        <p className="text-sm text-zinc-400">Week runs Wed 12:00 AM – Tue 11:59 PM. Settlement confirmed on Tuesday evening.</p>
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
                    {week.payout_confirmed && <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"><BadgeCheck className="h-3 w-3" /> Paid</span>}
                  </h3>
                  <p className="text-xs text-zinc-500">{week.total_matches} match(es) · Total pot: ${totalPot} · Paid out: ${totalWon}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
            </button>

            {isExpanded && (
              <div className="border-t border-white/5">
                {/* Weekly P&L Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
                  {week.player_summaries?.map((ps: any) => (
                    <div key={ps.player_id} className={`rounded-xl p-3 border ${ps.weekly_net >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/5 bg-white/5'}`}>
                      <p className="text-xs font-medium text-white">{ps.player_name}</p>
                      <p className={`text-lg font-bold mt-1 ${ps.weekly_net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ps.weekly_net >= 0 ? '+' : ''}${ps.weekly_net}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">{ps.wins}W / {ps.matches_played}M · Won: ${ps.total_won} · Paid: ${ps.total_paid}</p>
                    </div>
                  ))}
                </div>

                {/* Weekly Payout Total + Actions */}
                <div className="mx-4 mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Weekly Payout Summary</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs">
                      <span className="text-zinc-400">{week.total_matches} matches settled</span>
                      <span className="text-zinc-400">Total pot: <span className="text-white font-medium">${totalPot}</span></span>
                      <span className="text-zinc-400">Total won: <span className="text-emerald-400 font-medium">${totalWon}</span></span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {week.player_summaries?.filter((ps: any) => ps.weekly_net !== 0).map((ps: any) => (
                        <span key={ps.player_id} className={`text-xs font-medium px-2 py-0.5 rounded ${ps.weekly_net > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                          {ps.player_name}: {ps.weekly_net > 0 ? '+' : ''}${ps.weekly_net}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {/* Export PDF */}
                    <button onClick={() => exportWeekPDF(week)}
                      className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors">
                      <FileDown className="h-4 w-4" />
                      Export PDF
                    </button>
                    {/* Confirm Payout */}
                    {isAdmin && !week.payout_confirmed && (
                      <button onClick={() => confirmWeekPayout(week.week_id)} disabled={confirming === week.week_id}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        {confirming === week.week_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                        Confirm Week Payout
                      </button>
                    )}
                    {week.payout_confirmed && (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                          <BadgeCheck className="h-4 w-4" /> Payout Confirmed
                        </span>
                        {isAdmin && (
                          <button onClick={() => unconfirmWeekPayout(week.week_id)} disabled={confirming === week.week_id}
                            className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors">
                            {confirming === week.week_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                            Undo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed Results Table */}
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="min-w-full divide-y divide-white/5">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">Player</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">Match</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">Batter A</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">A Runs</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">Batter B</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">B Runs</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">Total</th>
                        <th className="px-6 py-2 text-left text-xs font-medium uppercase text-zinc-400">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {week.player_summaries?.flatMap((ps: any) =>
                        ps.results.map((r: any) => (
                          <tr key={r.id} className={r.is_winner ? 'bg-emerald-500/5' : 'hover:bg-white/5'}>
                            <td className="px-6 py-2 text-sm font-medium text-white">{ps.player_name}</td>
                            <td className="px-6 py-2 text-xs text-zinc-400 truncate max-w-[180px]">{r.match?.team_a_name} vs {r.match?.team_b_name}</td>
                            <td className="px-6 py-2 text-xs text-zinc-300">{r.player_a_name || '—'}</td>
                            <td className="px-6 py-2 text-sm font-bold text-blue-400">{r.player_a_runs}</td>
                            <td className="px-6 py-2 text-xs text-zinc-300">{r.player_b_name || '—'}</td>
                            <td className="px-6 py-2 text-sm font-bold text-blue-400">{r.player_b_runs}</td>
                            <td className="px-6 py-2 text-sm font-bold text-white">{r.total_runs}</td>
                            <td className="px-6 py-2">
                              {r.is_winner ? (
                                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">+${r.payout - (r.match?.bet_amount || 100)}</span>
                              ) : r.total_runs > 0 ? (
                                <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">-${r.match?.bet_amount || 100}</span>
                              ) : <span className="text-xs text-zinc-600">—</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
