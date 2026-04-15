'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Loader2, TrendingUp, TrendingDown, Trophy, ChevronDown, ChevronUp, FileDown, Edit3, Check, X, User } from 'lucide-react';

export default function SettlementsPage() {
  const [data, setData] = useState<any>({ player_settlements: [] });
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [editPayout, setEditPayout] = useState('');
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => { fetchSettlement(); }, []);

  const fetchSettlement = async () => {
    try {
      const d = await api.get('/api/draws/settlement');
      setData(d);
      if (d.player_settlements?.length > 0) setExpandedPlayer(d.player_settlements[0].player_id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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

  // ─── Export Player Report as PDF ───
  const exportPlayerPDF = async (player: any) => {
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
    doc.text(`IPL Betting – ${player.player_name} Settlement Report`, 14, 18);
    doc.setFontSize(12);
    doc.setTextColor(148, 163, 184);
    doc.text(`${player.total_matches} matches · ${player.total_wins} wins · Net: ${player.net_balance >= 0 ? '+' : ''}$${player.net_balance}`, 14, 28);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`, 14, 35);

    let y = 48;

    // ─── Summary ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Settlement Summary', 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Total Matches', `${player.total_matches}`],
        ['Total Wins', `${player.total_wins}`],
        ['Total Won', `$${player.total_won}`],
        ['Total Paid', `$${player.total_paid}`],
        ['Net Balance', `${player.net_balance >= 0 ? '+' : ''}$${player.net_balance}`],
      ],
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 4 && data.column.index === 1) {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) { data.cell.styles.textColor = [5, 150, 105]; }
          else if (val.startsWith('-')) { data.cell.styles.textColor = [220, 38, 38]; }
        }
      },
      margin: { left: 14, right: 14 },
      theme: 'striped'
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ─── Match-by-Match Detail ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Match-by-Match Breakdown', 14, y);
    y += 2;

    const detailRows: any[] = [];
    (player.results || []).forEach((r: any) => {
      const matchLabel = `${r.match?.team_a_name || '?'} vs ${r.match?.team_b_name || '?'}`;
      const matchDate = r.match?.date ? new Date(r.match.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '';
      const betAmt = r.match?.bet_amount || 100;
      const net = r.is_winner ? `+$${r.payout - betAmt}` : r.total_runs > 0 ? `-$${betAmt}` : '—';
      detailRows.push([
        matchDate,
        matchLabel,
        `${r.player_a_name || '—'}`,
        r.player_a_runs ?? '',
        `${r.player_b_name || '—'}`,
        r.player_b_runs ?? '',
        r.total_runs || '',
        `$${r.payout}`,
        net,
        r.is_winner ? '⭐' : ''
      ]);
    });

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Match', 'Batter A', 'A Runs', 'Batter B', 'B Runs', 'Total', 'Payout', 'Net', 'Win']],
      body: detailRows,
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 55 },
        2: { cellWidth: 28 },
        3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 28 },
        5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 18, halign: 'center' },
        8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        9: { cellWidth: 12, halign: 'center' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && (data.column.index === 3 || data.column.index === 5)) {
          data.cell.styles.textColor = [30, 64, 175];
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

    // ─── Footer on all pages ───
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`IPL Betting Platform – ${player.player_name} – Page ${i}/${pageCount}`, 14, doc.internal.pageSize.getHeight() - 8);
      doc.text('All Star Group', pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`IPL_Settlement_${player.player_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const settlements = data.player_settlements || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center text-2xl font-bold tracking-tight text-white mb-1"><DollarSign className="mr-3 text-primary h-6 w-6" /> Player Settlements</h1>
        <p className="text-sm text-zinc-400">Per-player settlement breakdown across all matches. {isAdmin && 'Click edit to adjust payouts.'}</p>
      </div>

      {/* Overall Leaderboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {settlements.map((ps: any, i: number) => (
          <button key={ps.player_id} onClick={() => setExpandedPlayer(expandedPlayer === ps.player_id ? null : ps.player_id)}
            className={`text-left rounded-2xl border p-5 backdrop-blur-xl transition-all hover:scale-[1.02] ${
              i === 0 && ps.net_balance > 0 ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50' : 
              expandedPlayer === ps.player_id ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-black/40 hover:border-white/10'
            }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-medium text-white">{ps.player_name}</p>
                <p className="text-xs text-zinc-500">{ps.total_matches}M · {ps.total_wins}W</p>
              </div>
              {i === 0 && ps.net_balance > 0 && <Trophy className="h-5 w-5 text-amber-400" />}
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              {ps.net_balance >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400 mr-1" /> : <TrendingDown className="h-4 w-4 text-rose-400 mr-1" />}
              <span className={`text-2xl font-bold ${ps.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{ps.net_balance >= 0 ? '+' : ''}${ps.net_balance}</span>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-zinc-500">
              <span>Won: <span className="text-emerald-400">${ps.total_won}</span></span>
              <span>Paid: <span className="text-rose-400">${ps.total_paid}</span></span>
            </div>
          </button>
        ))}
      </div>

      {/* Per-Player Detailed Breakdown */}
      {settlements.map((ps: any) => {
        const isExpanded = expandedPlayer === ps.player_id;
        if (!isExpanded) return null;

        return (
          <div key={ps.player_id} className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Player Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 font-bold text-white text-sm shadow-lg shadow-indigo-500/20">
                  {ps.player_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{ps.player_name}</h3>
                  <p className="text-xs text-zinc-500">{ps.total_matches} matches played · {ps.total_wins} wins</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => exportPlayerPDF(ps)}
                  className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors">
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Summary Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-white/5">
              <div className="rounded-xl p-3 border border-white/5 bg-white/5">
                <p className="text-xs text-zinc-500">Total Won</p>
                <p className="text-lg font-bold text-emerald-400">${ps.total_won}</p>
              </div>
              <div className="rounded-xl p-3 border border-white/5 bg-white/5">
                <p className="text-xs text-zinc-500">Total Paid</p>
                <p className="text-lg font-bold text-rose-400">${ps.total_paid}</p>
              </div>
              <div className={`rounded-xl p-3 border ${ps.net_balance >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
                <p className="text-xs text-zinc-500">Net P&L</p>
                <p className={`text-lg font-bold ${ps.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ps.net_balance >= 0 ? '+' : ''}${ps.net_balance}
                </p>
              </div>
              <div className="rounded-xl p-3 border border-white/5 bg-white/5">
                <p className="text-xs text-zinc-500">Win Rate</p>
                <p className="text-lg font-bold text-blue-400">{ps.total_matches > 0 ? Math.round((ps.total_wins / ps.total_matches) * 100) : 0}%</p>
              </div>
            </div>

            {/* Match Results Table */}
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="min-w-full divide-y divide-white/5">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Match</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Week</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Batter A</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">A Runs</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Batter B</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">B Runs</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Total</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Payout</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Result</th>
                    {isAdmin && <th className="px-4 py-2 text-left text-xs font-medium uppercase text-zinc-400">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(ps.results || []).map((r: any) => {
                    const betAmt = r.match?.bet_amount || 100;
                    const net = r.is_winner ? r.payout - betAmt : -betAmt;
                    const matchDate = r.match?.date ? new Date(r.match.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '—';
                    const weekLabel = r.weekly_draw?.week_label || '—';
                    const isEditing = editingResult === r.id;

                    return (
                      <tr key={r.id} className={r.is_winner ? 'bg-emerald-500/5' : 'hover:bg-white/5'}>
                        <td className="px-4 py-2 text-xs text-zinc-400 whitespace-nowrap">{matchDate}</td>
                        <td className="px-4 py-2 text-xs text-zinc-300 truncate max-w-[180px]">{r.match?.team_a_name} vs {r.match?.team_b_name}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">{weekLabel}</td>
                        <td className="px-4 py-2 text-xs text-zinc-300">{r.player_a_name || '—'}</td>
                        <td className="px-4 py-2 text-sm font-bold text-blue-400">{r.player_a_runs}</td>
                        <td className="px-4 py-2 text-xs text-zinc-300">{r.player_b_name || '—'}</td>
                        <td className="px-4 py-2 text-sm font-bold text-blue-400">{r.player_b_runs}</td>
                        <td className="px-4 py-2 text-sm font-bold text-white">{r.total_runs}</td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editPayout}
                              onChange={e => setEditPayout(e.target.value)}
                              className="w-20 rounded-lg border border-primary/30 bg-white/5 px-2 py-1 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                          ) : (
                            <span className="text-sm text-zinc-300">${r.payout}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {r.is_winner ? (
                            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">+${net}</span>
                          ) : r.total_runs > 0 ? (
                            <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">-${betAmt}</span>
                          ) : <span className="text-xs text-zinc-600">—</span>}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleEditSave(r.id)} disabled={saving}
                                  className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
                                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </button>
                                <button onClick={() => { setEditingResult(null); setEditPayout(''); }}
                                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 transition-colors">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingResult(r.id); setEditPayout(String(r.payout)); }}
                                className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white transition-colors">
                                <Edit3 className="h-4 w-4" />
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
        );
      })}

      {settlements.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-center rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl">
          <User className="h-10 w-10 text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-400">No settlement data yet. Settle some matches first!</p>
        </div>
      )}
    </div>
  );
}
