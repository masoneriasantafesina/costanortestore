'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  rol: 'administrador' | 'operador';
  creado_en: string;
};

export default function UsuariosPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('perfiles').select('*').order('creado_en', { ascending: false });
    setPerfiles((data as any) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarRol(perfil: Perfil, rol: Perfil['rol']) {
    await supabase.from('perfiles').update({ rol }).eq('id', perfil.id);
    await cargar();
  }

  async function eliminarUsuario(perfil: Perfil) {
    if (!confirm(`¿Sacarle el acceso al panel a ${perfil.nombre || perfil.email}?`)) return;
    const { data: sesion } = await supabase.auth.getSession();
    await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion.session?.access_token}`,
      },
      body: JSON.stringify({ id: perfil.id }),
    });
    await cargar();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Usuarios</h1>
        <button onClick={() => setFormAbierto(true)} className="btn-primary">
          + Invitar usuario
        </button>
      </div>

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-card border border-frost-100 divide-y divide-frost-100">
          {perfiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-frost-800">{p.nombre || p.email}</p>
                <p className="text-xs text-frost-500">{p.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="input-field text-sm py-1.5"
                  value={p.rol}
                  onChange={(e) => cambiarRol(p, e.target.value as Perfil['rol'])}
                >
                  <option value="administrador">Administrador</option>
                  <option value="operador">Operador</option>
                </select>
                <button
                  onClick={() => eliminarUsuario(p)}
                  className="text-xs font-medium text-red-600 border border-red-200 rounded-card px-2 py-1 hover:bg-red-50"
                >
                  Sacar acceso
                </button>
              </div>
            </div>
          ))}
          {perfiles.length === 0 && (
            <p className="p-4 text-sm text-frost-400">Todavía no invitaste a nadie.</p>
          )}
        </div>
      )}

      {formAbierto && (
        <FormularioInvitar
          onCerrar={() => setFormAbierto(false)}
          onInvitado={() => {
            setFormAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function FormularioInvitar({ onCerrar, onInvitado }: { onCerrar: () => void; onInvitado: () => void }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<'administrador' | 'operador'>('operador');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');

    const { data: sesion } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion.session?.access_token}`,
      },
      body: JSON.stringify({ email, nombre, rol }),
    });

    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'No se pudo enviar la invitación');
      return;
    }
    onInvitado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <form onSubmit={invitar} className="relative bg-white rounded-card p-6 w-full max-w-sm space-y-3">
        <h2 className="font-display text-xl text-frost-800 mb-2">Invitar usuario</h2>
        <input
          required
          type="email"
          placeholder="Email"
          className="input-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Nombre (opcional)"
          className="input-field"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <select
          className="input-field"
          value={rol}
          onChange={(e) => setRol(e.target.value as 'administrador' | 'operador')}
        >
          <option value="operador">Operador</option>
          <option value="administrador">Administrador</option>
        </select>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-frost-500">
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className="btn-primary">
            {enviando ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </div>
      </form>
    </div>
  );
}
