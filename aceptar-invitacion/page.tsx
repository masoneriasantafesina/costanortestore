'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AceptarInvitacionPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [sesionValida, setSesionValida] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let resuelto = false;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !resuelto) {
        resuelto = true;
        setSesionValida(true);
        setVerificando(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !resuelto) {
        resuelto = true;
        setSesionValida(true);
        setVerificando(false);
      }
    });

    const timeout = setTimeout(() => {
      if (!resuelto) {
        resuelto = true;
        setVerificando(false);
      }
    }, 5000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function guardarPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    const { error: errorUpdate } = await supabase.auth.updateUser({ password });
    setGuardando(false);

    if (errorUpdate) {
      setError(errorUpdate.message);
      return;
    }

    router.push('/admin/pedidos');
  }

  if (verificando) {
    return (
      <div className="min-h-screen bg-frost-800 flex items-center justify-center px-4">
        <p className="text-frost-200">Verificando invitación...</p>
      </div>
    );
  }

  if (!sesionValida) {
    return (
      <div className="min-h-screen bg-frost-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-card p-6 w-full max-w-sm text-center">
          <p className="text-frost-800 font-medium mb-2">El link de invitación no es válido o ya venció.</p>
          <p className="text-sm text-frost-500">
            Pedile a quien te invitó que te mande una invitación nueva.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-frost-800 flex items-center justify-center px-4">
      <form onSubmit={guardarPassword} className="bg-white rounded-card p-6 w-full max-w-sm space-y-4">
        <h1 className="font-display text-xl text-frost-800">Elegí tu contraseña</h1>
        <input
          type="password"
          required
          placeholder="Nueva contraseña"
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Repetir contraseña"
          className="input-field"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={guardando} className="btn-primary w-full">
          {guardando ? 'Guardando...' : 'Entrar al panel'}
        </button>
      </form>
    </div>
  );
}
