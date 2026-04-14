'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Dices,
  DollarSign,
  Settings,
  LogOut,
  Loader2,
  Menu,
  Bell,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="absolute inset-0 blur-xl opacity-40 bg-primary rounded-full" />
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Players', href: '/dashboard/players', icon: Users },
    { name: 'Draws', href: '/dashboard/draws', icon: Dices },
    { name: 'Settlements', href: '/dashboard/settlements', icon: DollarSign },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* ── Sidebar Desktop ── */}
      <aside className="hidden w-64 flex-col sidebar-glass md:flex">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-white/5 px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl btn-primary">
              <Dices className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">IPL Admin</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">Season 2026</span>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Navigation</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-premium ${
                    isActive
                      ? 'nav-active'
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                      isActive ? 'text-primary' : 'text-zinc-600 group-hover:text-zinc-400'
                    }`}
                  />
                  {item.name}
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary glow-blue" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-xl card-glass p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 font-semibold text-white text-sm shadow-lg shadow-indigo-500/20">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{user.email}</p>
              <p className="truncate text-[11px] text-zinc-500 capitalize">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-zinc-500 transition-premium hover:bg-white/10 hover:text-red-400"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm mobile-sidebar-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 sidebar-glass flex flex-col mobile-sidebar-panel">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl btn-primary">
                  <Dices className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-base font-bold tracking-tight text-white">IPL Admin</span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">Season 2026</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Nav */}
            <div className="flex-1 overflow-y-auto py-6 px-3">
              <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Navigation</p>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`group flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-premium ${
                        isActive
                          ? 'nav-active'
                          : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                          isActive ? 'text-primary' : 'text-zinc-600 group-hover:text-zinc-400'
                        }`}
                      />
                      {item.name}
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary glow-blue" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
            {/* User Profile */}
            <div className="border-t border-white/5 p-3">
              <div className="flex items-center gap-3 rounded-xl card-glass p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 font-semibold text-white text-sm shadow-lg shadow-indigo-500/20">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-white">{user.email}</p>
                  <p className="truncate text-[11px] text-zinc-500 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="rounded-lg p-2 text-zinc-500 transition-premium hover:bg-white/10 hover:text-red-400"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content Wrapper ── */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between header-bar px-4 sm:px-6 lg:px-8 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-zinc-500 hover:text-white md:hidden transition-colors p-1 -ml-1"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-2">
            <span className="text-sm font-bold text-white">IPL Admin</span>
          </div>

          {/* Breadcrumb-style page indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-600">
            <span className="text-zinc-500">IPL 2026</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-400 font-medium">{navItems.find(n => n.href === pathname)?.name || 'Dashboard'}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              LIVE
            </div>
            <button className="relative rounded-full p-2 text-zinc-500 transition-premium hover:bg-white/10 hover:text-white">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary glow-blue" />
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-4">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden mobile-nav-glass">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[60px] transition-all ${
                  isActive
                    ? 'text-primary'
                    : 'text-zinc-600 active:text-zinc-300'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-[10px] font-medium">{item.name === 'Settlements' ? 'Settle' : item.name}</span>
                {isActive && (
                  <div className="h-0.5 w-4 rounded-full bg-primary mt-0.5" />
                )}
              </Link>
            );
          })}
          {/* More / Settings */}
          <Link
            href="/dashboard/settings"
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[60px] transition-all ${
              pathname === '/dashboard/settings'
                ? 'text-primary'
                : 'text-zinc-600 active:text-zinc-300'
            }`}
          >
            <Settings className={`h-5 w-5 ${pathname === '/dashboard/settings' ? 'text-primary' : ''}`} />
            <span className="text-[10px] font-medium">Settings</span>
            {pathname === '/dashboard/settings' && (
              <div className="h-0.5 w-4 rounded-full bg-primary mt-0.5" />
            )}
          </Link>
        </div>
      </nav>
    </div>
  );
}
