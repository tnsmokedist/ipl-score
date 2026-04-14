'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password }, { requireAuth: false });
      
      if (response.token) {
        login(response.token, {
          id: response.id,
          email: response.email,
          role: response.role,
        });
      } else {
        setError('Invalid credentials returned');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center p-4">
      {/* Stadium Floodlight Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-600/15 to-indigo-800/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] -right-[15%] w-[50%] h-[70%] rounded-full bg-gradient-to-tl from-purple-900/15 to-blue-900/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Premium Glassmorphic Login Card */}
        <div className="rounded-3xl card-glass p-10 transition-all duration-500">
          
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl btn-primary float-subtle">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl tracking-tight font-light text-white">
              Admin Portal
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in to manage the IPL betting system
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="animate-in fade-in slide-in-from-top-2 rounded-xl bg-red-500/8 p-3.5 text-center text-sm font-medium text-red-400 border border-red-500/15">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Mail className="h-[18px] w-[18px] text-zinc-600 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-white/8 bg-white/4 py-3.5 pl-12 pr-4 text-white placeholder-zinc-600 transition-all duration-300 focus:border-primary/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="admin@cricket.local"
                />
              </div>

              <div className="relative group">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Lock className="h-[18px] w-[18px] text-zinc-600 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/8 bg-white/4 py-3.5 pl-12 pr-4 text-white placeholder-zinc-600 transition-all duration-300 focus:border-primary/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center overflow-hidden rounded-xl btn-primary px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="relative flex items-center">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-zinc-600">
            Secure administrative access only
          </div>
        </div>
      </div>
    </div>
  );
}
