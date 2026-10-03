'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      const res = await fetch('/api/auth/resolver-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreUsuario: usuario }),
      });
      const data = await res.json();

      if (!data.email) {
        setError('Usuario o contraseña incorrectos.');
        setCargando(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password });
      setCargando(false);
      if (error) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }
      router.push('/admin/pedidos');
    } catch {
      setCargando(false);
      setError('No se pudo conectar con el servidor.');
    }
  }

  return (
    <div className="min-h-screen bg-frost-800 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-mango-500/10" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />

      <form
        onSubmit={handleLogin}
        className="relative bg-white rounded-card p-7 w-full max-w-sm space-y-4 shadow-2xl"
      >
        <div className="mb-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/tilda-wordmark.png" alt="Tild@" className="h-20 sm:h-24 mx-auto" />
          <p className="text-sm text-frost-400 tracking-wide mt-1">Costa Norte Mayorista</p>
        </div>
        <p className="text-sm text-frost-500 text-center mb-2">Ingresá con tu usuario y contraseña.</p>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Usuario</label>
          <input
            type="text"
            required
            placeholder="ej: leo, martina"
            autoCapitalize="none"
            autoCorrect="off"
            className="input-field mt-1"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Contraseña</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            className="input-field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-card px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={cargando} className="btn-primary w-full">
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
