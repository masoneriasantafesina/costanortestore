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
    <div className="min-h-screen bg-frost-800 flex items-center justify-center px-4">
      <form onSubmit={handleLogin} className="bg-white rounded-card p-6 w-full max-w-sm space-y-4">
        <h1 className="font-display text-xl text-frost-800">Panel administrativo</h1>
        <input
          type="text"
          required
          placeholder="Usuario"
          autoCapitalize="none"
          autoCorrect="off"
          className="input-field"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Contraseña"
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={cargando} className="btn-primary w-full">
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
