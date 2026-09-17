'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function RegistrarsePage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function registrarse(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);

    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nombre, password, codigo }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // respuesta no era JSON
      }

      if (!res.ok) {
        setError(data?.error ?? `Error inesperado (código ${res.status}).`);
        setEnviando(false);
        return;
      }

      // El usuario ya está creado y confirmado del lado del servidor;
      // ahora inicia sesión normalmente con lo que acaba de elegir.
      const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password });
      setEnviando(false);

      if (errorLogin) {
        setError('Te registraste bien, pero hubo un problema al iniciar sesión. Probá entrar desde /admin/login.');
        return;
      }

      router.push('/admin/pedidos');
    } catch (err: any) {
      setEnviando(false);
      setError('No se pudo conectar con el servidor: ' + (err?.message ?? 'error desconocido'));
    }
  }

  return (
    <div className="min-h-screen bg-frost-800 flex items-center justify-center px-4">
      <form onSubmit={registrarse} className="bg-white rounded-card p-6 w-full max-w-sm space-y-4">
        <h1 className="font-display text-xl text-frost-800">Crear cuenta</h1>
        <input
          required
          placeholder="Tu nombre"
          className="input-field"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          required
          type="email"
          placeholder="Email"
          className="input-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required
          type="password"
          placeholder="Contraseña"
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          required
          type="password"
          placeholder="Repetir contraseña"
          className="input-field"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />
        <input
          required
          placeholder="Código de invitación"
          className="input-field"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={enviando} className="btn-primary w-full">
          {enviando ? 'Creando cuenta...' : 'Crear cuenta y entrar'}
        </button>
      </form>
    </div>
  );
}
