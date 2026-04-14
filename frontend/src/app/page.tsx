'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Loader2, LogIn, Trophy, Sparkles, ChevronDown } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Pre-warm the backend so login is instant
    api.get('/api/health', { requireAuth: false }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-background">
      {/* ── Animated Background Layers ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Top-left floodlight */}
        <div className="absolute -top-[20%] -left-[10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-900/12 blur-[160px] animate-pulse" />
        {/* Bottom-right glow */}
        <div className="absolute bottom-[-15%] -right-[10%] w-[50%] h-[60%] rounded-full bg-gradient-to-tl from-purple-900/18 to-blue-800/10 blur-[140px]" />
        {/* Center golden accent */}
        <div className="absolute top-[30%] left-[35%] w-[35%] h-[35%] rounded-full bg-gradient-to-br from-amber-500/8 to-orange-600/5 blur-[120px]" />
        {/* Floating particle dots */}
        <div className="absolute top-[15%] right-[20%] w-2 h-2 rounded-full bg-primary/40 float-subtle" />
        <div className="absolute top-[60%] left-[15%] w-1.5 h-1.5 rounded-full bg-amber-400/30 float-subtle" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[35%] right-[35%] w-1 h-1 rounded-full bg-purple-400/30 float-subtle" style={{ animationDelay: '4s' }} />
      </div>

      {/* ── Grid Overlay Pattern ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Main Content ── */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
        {/* Top Badge */}
        <div
          className={`mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-5 py-2 text-xs font-medium text-zinc-400 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>SEASON 2026 — LIVE NOW</span>
          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400 pulse-live" />
        </div>

        {/* Hero Image */}
        <div
          className={`relative mb-10 transition-all duration-1000 ${
            mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          {/* Glow ring behind image */}
          <div className="absolute inset-0 -m-4 rounded-[2rem] bg-gradient-to-br from-primary/20 via-purple-500/10 to-amber-500/15 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
            <Image
              src="/ipl-hero.png"
              alt="IPL Cricket Stadium"
              width={600}
              height={400}
              priority
              className="block w-full max-w-[520px] h-auto object-cover"
            />
            {/* Image overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
            {/* Trophy badge on image */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-lg px-4 py-2 border border-white/10">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300 tracking-wide">ALL STAR GROUP</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1
          className={`text-center text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight transition-all duration-1000 delay-200 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="block bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Welcome to
          </span>
          <span className="relative mt-2 block">
            <span className="bg-gradient-to-r from-primary via-blue-400 to-purple-400 bg-clip-text text-transparent">
              All Star Group
            </span>
          </span>
          <span className="mt-1 block bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent text-3xl sm:text-4xl md:text-5xl font-extrabold">
            IPL Scoreboard
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className={`mt-5 max-w-md text-center text-base sm:text-lg text-zinc-500 leading-relaxed transition-all duration-1000 delay-400 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Track live scores, manage matchups, and settle bets — all from one premium dashboard.
        </p>

        {/* Decorative pitch line */}
        <div className="pitch-line w-48 my-8 rounded-full" />

        {/* Login Button */}
        <div
          className={`transition-all duration-1000 delay-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <button
            id="homepage-login-button"
            onClick={() => router.push('/login')}
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl btn-primary px-10 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
          >
            {/* Shimmer overlay */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <LogIn className="h-5 w-5 relative z-10 transition-transform group-hover:scale-110" />
            <span className="relative z-10">Sign In to Dashboard</span>
          </button>
        </div>

        {/* Stats row */}
        <div
          className={`mt-12 flex flex-wrap justify-center gap-6 sm:gap-10 transition-all duration-1000 delay-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {[
            { label: 'Live Matches', value: '🏏' },
            { label: 'Real-time Scores', value: '📊' },
            { label: 'Instant Payouts', value: '💰' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="text-xl">{stat.value}</span>
              <span className="font-medium text-zinc-400">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-600">
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="absolute bottom-0 inset-x-0 z-10 py-4 text-center text-xs text-zinc-700">
        © 2026 All Star Group — IPL Scoreboard Platform
      </footer>
    </div>
  );
}
