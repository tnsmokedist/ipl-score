'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users, Activity, Dices, DollarSign, Loader2 } from 'lucide-react';

export default function DashboardOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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
    </div>
  );
}
