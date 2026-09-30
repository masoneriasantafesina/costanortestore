'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { registrarLog } from '@/lib/log';

type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  nombre_usuario: string | null;
  rol: 'administrador' | 'operador' | 'nuevo';
  creado_en: string;
};

export default function UsuariosPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session) {
      setCargando(false);
      return;
    }

    const { data: miPerfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', sesion.session.user.id)
      .single();

    if (miPerfil?.rol !== 'administrador') {
      setSinPermiso(true);
      setCargando(false);
      return;
    }

    const { data } = await supabase.from('perfiles').select('*').order('creado_en', { ascending: false });
    setPerfiles((data as any) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarRol(perfil: Perfil, rol: Perfil['rol']) {
    await supabase.from('perfiles').update({ rol }).eq('id', perfil.id);
    await registrarLog(
      'cambiar_rol_usuario',
      'usuario',
      perfil.id,
      `Rol de ${perfil.nombre || perfil.nombre_usuario} cambiado de "${perfil.rol}" a "${rol}"`
    );
    await cargar();
  }

  async function eliminarUsuario(perfil: Perfil) {
    if (!confirm(`¿Sacarle el acceso al panel a ${perfil.nombre || perfil.nombre_usuario}?`)) return;
    const { data: sesion } = await supabase.auth.getSession();
    await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion.session?.access_token}`,
      },
      body: JSON.stringify({ id: perfil.id }),
    });
    await registrarLog(
      'eliminar_usuario',
      'usuario',
      perfil.id,
      `Acceso eliminado para ${perfil.nombre || perfil.nombre_usuario}`
    );
    await cargar();
  }

  if (cargando) return <p className="text-frost-500">Cargando...</p>;

  if (sinPermiso) {
    return (
      <div>
        <h1 className="font-display text-2xl text-frost-800 mb-5">Usuarios</h1>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-card px-4 py-3">
          Esta sección es solo para administradores.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Usuarios</h1>
        <button onClick={() => setFormAbierto(true)} className="btn-primary">
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-card border border-frost-100 divide-y divide-frost-100">
        {perfiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-frost-800">{p.nombre || p.nombre_usuario}</p>
              <p className="text-xs text-frost-500">
                usuario: {p.nombre_usuario ?? '—'}
                {p.telefono && ` · ${p.telefono}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input-field text-sm py-1.5"
                value={p.rol}
                onChange={(e) => cambiarRol(p, e.target.value as Perfil['rol'])}
              >
                <option value="nuevo">Nuevo (sin acceso)</option>
                <option value="operador">Operador</option>
                <option value="administrador">Administrador</option>
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
          <p className="p-4 text-sm text-frost-400">Todavía no cargaste a nadie.</p>
        )}
      </div>

      {formAbierto && (
        <FormularioCrear
          onCerrar={() => setFormAbierto(false)}
          onCreado={() => {
            setFormAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function FormularioCrear({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'administrador' | 'operador'>('operador');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');

    try {
      const { data: sesion } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion.session?.access_token}`,
        },
        body: JSON.stringify({ nombre, telefono, nombreUsuario, password, rol }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // La respuesta no era JSON
      }

      if (!res.ok) {
        setError(data?.error ?? `Error inesperado (código ${res.status}).`);
        return;
      }

      onCreado();
    } catch (err: any) {
      setError('No se pudo conectar con el servidor: ' + (err?.message ?? 'error desconocido'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <form onSubmit={crear} className="relative bg-white rounded-card p-6 w-full max-w-sm space-y-3">
        <h2 className="font-display text-xl text-frost-800 mb-2">Nuevo usuario</h2>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Nombre y apellido</label>
          <input required className="input-field mt-1" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Teléfono celular</label>
          <input className="input-field mt-1" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Nombre de usuario</label>
          <input
            required
            placeholder="ej: leo, martina, repartidor1"
            className="input-field mt-1"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
          />
          <p className="text-xs text-frost-400 mt-1">Sin espacios. Es lo que va a escribir para entrar al panel.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Contraseña provisoria</label>
          <input
            required
            type="text"
            className="input-field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-frost-400 mt-1">
            Al menos 6 caracteres. La persona la puede cambiar después desde "Mi perfil".
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Tipo de usuario</label>
          <select
            className="input-field mt-1"
            value={rol}
            onChange={(e) => setRol(e.target.value as 'administrador' | 'operador')}
          >
            <option value="operador">Operador</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-frost-500">
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className="btn-primary">
            {enviando ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}
