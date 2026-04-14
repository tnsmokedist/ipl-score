'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users, Activity, Dices, DollarSign, Loader2, Trophy, TrendingUp, Crown } from 'lucide-react';

interface TopBatsman {
  rank: number;
  name: string;
  team: string;
  runs: number;
  matches: number;
  average: number;
  strikeRate: number;
  imageUrl: string;
}

const TEAM_COLORS: Record<string, { gradient: string; border: string; glow: string; badge: string }> = {
  SRH: { gradient: 'from-orange-500/20 via-orange-600/10 to-red-500/5', border: 'border-orange-500/30', glow: 'shadow-orange-500/20', badge: 'bg-orange-500/20 text-orange-300' },
  RCB: { gradient: 'from-red-500/20 via-red-600/10 to-yellow-500/5', border: 'border-red-500/30', glow: 'shadow-red-500/20', badge: 'bg-red-500/20 text-red-300' },
  MI:  { gradient: 'from-blue-500/20 via-blue-600/10 to-indigo-500/5', border: 'border-blue-500/30', glow: 'shadow-blue-500/20', badge: 'bg-blue-500/20 text-blue-300' },
  CSK: { gradient: 'from-yellow-500/20 via-yellow-600/10 to-amber-500/5', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-300' },
  KKR: { gradient: 'from-purple-500/20 via-purple-600/10 to-yellow-500/5', border: 'border-purple-500/30', glow: 'shadow-purple-500/20', badge: 'bg-purple-500/20 text-purple-300' },
  PBKS: { gradient: 'from-red-500/20 via-pink-600/10 to-red-500/5', border: 'border-red-400/30', glow: 'shadow-red-400/20', badge: 'bg-red-400/20 text-red-300' },
  GT:  { gradient: 'from-cyan-500/20 via-teal-600/10 to-blue-500/5', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20', badge: 'bg-cyan-500/20 text-cyan-300' },
  DC:  { gradient: 'from-blue-500/20 via-red-600/10 to-blue-500/5', border: 'border-blue-400/30', glow: 'shadow-blue-400/20', badge: 'bg-blue-400/20 text-blue-300' },
  RR:  { gradient: 'from-pink-500/20 via-blue-600/10 to-pink-500/5', border: 'border-pink-500/30', glow: 'shadow-pink-500/20', badge: 'bg-pink-500/20 text-pink-300' },
  LSG: { gradient: 'from-cyan-500/20 via-blue-600/10 to-cyan-500/5', border: 'border-cyan-400/30', glow: 'shadow-cyan-400/20', badge: 'bg-cyan-400/20 text-cyan-300' },
};

const RANK_STYLES = [
  { ring: 'ring-amber-400/50', badge: 'bg-gradient-to-r from-amber-400 to-yellow-500', icon: '👑', label: 'Orange Cap' },
  { ring: 'ring-zinc-300/40', badge: 'bg-gradient-to-r from-zinc-300 to-zinc-400', icon: '🥈', label: '2nd' },
  { ring: 'ring-amber-600/40', badge: 'bg-gradient-to-r from-amber-600 to-amber-700', icon: '🥉', label: '3rd' },
  { ring: 'ring-zinc-500/30', badge: 'bg-gradient-to-r from-zinc-500 to-zinc-600', icon: '4️⃣', label: '4th' },
];

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null);
  const [topBatsmen, setTopBatsmen] = useState<TopBatsman[]>([]);
  const [loading, setLoading] = useState(true);
  const [batsmenLoading, setBatsmenLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchTopBatsmen();
  }, []);

  const fetchStats = async () => {
    try {
      const [players, matches] = await Promise.all([
        api.get('/api/players'),
        api.get('/api/draws/matches')
      ]);

      const totalPlayers = players.length;
      const totalMatches = matches.length;
      const completedMatches = matches.filter((m: any) => m.status === 'COMPLETED').length;
      const pendingDraws = matches.filter((m: any) => m.status === 'UPCOMING').length;

      setStats({ totalPlayers, totalMatches, completedMatches, pendingDraws });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopBatsmen = async () => {
    try {
      const data = await api.get('/api/settings/top-batsmen');
      setTopBatsmen(data);
    } catch (e) {
      console.error('Failed to fetch top batsmen:', e);
    } finally {
      setBatsmenLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="absolute inset-0 blur-xl opacity-30 bg-primary rounded-full" />
        </div>
      </div>
    );
  }

  const cards = [
    { name: 'Betting Players', value: stats?.totalPlayers ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', glowColor: 'group-hover:shadow-blue-500/10', borderGlow: 'hover:border-blue-500/20' },
    { name: 'Total Matches', value: stats?.totalMatches ?? 0, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', glowColor: 'group-hover:shadow-purple-500/10', borderGlow: 'hover:border-purple-500/20' },
    { name: 'Pending Draws', value: stats?.pendingDraws ?? 0, icon: Dices, color: 'text-amber-400', bg: 'bg-amber-500/10', glowColor: 'group-hover:shadow-amber-500/10', borderGlow: 'hover:border-amber-500/20' },
    { name: 'Settled Matches', value: stats?.completedMatches ?? 0, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', glowColor: 'group-hover:shadow-emerald-500/10', borderGlow: 'hover:border-emerald-500/20' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          Dashboard Overview
        </h1>
        <p className="text-sm text-zinc-500">
          IPL 2026 Draw-Based Betting — March 28 to May 31
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.name}
            className={`group flex flex-col rounded-2xl card-elevated p-6 transition-premium ${card.borderGlow}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-zinc-500">{card.name}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} transition-premium`}>
                <card.icon className={`h-5 w-5 ${card.color} transition-colors`} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-bold text-white score-display">{card.value}</span>
            </div>
            {/* Subtle pitch-line accent */}
            <div className="mt-4 pitch-line rounded-full" />
          </div>
        ))}
      </div>

      {/* ── Top 4 Batsmen — Orange Cap Race ── */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Orange Cap Race</h2>
            <p className="text-xs text-zinc-500">Top run-scorers of IPL 2026</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400 tracking-wide">LIVE STANDINGS</span>
          </div>
        </div>

        {batsmenLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        ) : topBatsmen.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-zinc-600 text-sm">
            No batsmen data available
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topBatsmen.map((batsman, index) => {
              const teamColor = TEAM_COLORS[batsman.team] || TEAM_COLORS.MI;
              const rankStyle = RANK_STYLES[index] || RANK_STYLES[3];
              const isFirst = index === 0;

              return (
                <div
                  key={batsman.name}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${teamColor.border} ${teamColor.glow} bg-white/[0.03] backdrop-blur-sm`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Background gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${teamColor.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  {/* Shimmer effect on hover */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                  {/* Content */}
                  <div className="relative z-10 p-5">
                    {/* Rank badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${rankStyle.badge} shadow-lg`}>
                        {isFirst ? <Crown className="h-3 w-3" /> : null}
                        {rankStyle.label}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${teamColor.badge}`}>
                        {batsman.team}
                      </span>
                    </div>

                    {/* Player image */}
                    <div className="flex justify-center mb-4">
                      <div className={`relative h-20 w-20 rounded-full ring-2 ${rankStyle.ring} overflow-hidden bg-white/10 shadow-xl ${isFirst ? 'h-24 w-24 ring-[3px]' : ''}`}>
                        <img
                          src={batsman.imageUrl}
                          alt={batsman.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback to initials if image fails
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="h-full w-full flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br ${teamColor.gradient.replace(/\/\d+/g, '')}">${batsman.name.split(' ').map(n => n[0]).join('')}</div>`;
                          }}
                        />
                        {/* Orange cap glow for #1 */}
                        {isFirst && (
                          <div className="absolute -inset-1 rounded-full bg-amber-400/20 blur-md -z-10 animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Player name */}
                    <div className="text-center mb-3">
                      <h3 className={`font-bold text-white tracking-tight ${isFirst ? 'text-base' : 'text-sm'}`}>
                        {batsman.name}
                      </h3>
                    </div>

                    {/* Runs - hero stat */}
                    <div className="text-center mb-3">
                      <div className={`font-black text-white score-display ${isFirst ? 'text-4xl' : 'text-3xl'}`}>
                        {batsman.runs}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mt-0.5">
                        Runs
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex justify-center gap-4 text-center">
                      <div>
                        <div className="text-sm font-bold text-zinc-300">{batsman.matches}</div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-600">Mat</div>
                      </div>
                      {batsman.average > 0 && (
                        <div>
                          <div className="text-sm font-bold text-zinc-300">{batsman.average.toFixed(1)}</div>
                          <div className="text-[9px] uppercase tracking-wider text-zinc-600">Avg</div>
                        </div>
                      )}
                      {batsman.strikeRate > 0 && (
                        <div>
                          <div className="text-sm font-bold text-zinc-300">{batsman.strikeRate.toFixed(1)}</div>
                          <div className="text-[9px] uppercase tracking-wider text-zinc-600">SR</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom accent line */}
                  <div className={`h-0.5 bg-gradient-to-r ${teamColor.gradient.replace(/\/\d+/g, '/60')}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
