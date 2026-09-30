'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type MiPerfil = {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  foto_url: string | null;
  nombre_usuario: string | null;
  rol: string;
};

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [mensajeDatos, setMensajeDatos] = useState('');

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  async function cargar() {
    setCargando(true);
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session) {
      setCargando(false);
      return;
    }
    const { data } = await supabase.from('perfiles').select('*').eq('id', sesion.session.user.id).single();
    if (data) {
      setPerfil(data as any);
      setNombre(data.nombre ?? '');
      setTelefono(data.telefono ?? '');
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function llamarApiPerfil(body: Record<string, any>) {
    const { data: sesion } = await supabase.auth.getSession();
    const res = await fetch('/api/perfil', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    return res;
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoDatos(true);
    setMensajeDatos('');
    await llamarApiPerfil({ nombre, telefono });
    setGuardandoDatos(false);
    setMensajeDatos('Datos actualizados.');
    await cargar();
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !perfil) return;
    setSubiendoFoto(true);
    setErrorFoto('');
    const extension = archivo.name.split('.').pop() ?? 'jpg';
    const ruta = `perfiles/${perfil.id}-${Date.now()}.${extension}`;

    const { error: errorSubida } = await supabase.storage.from('fotos').upload(ruta, archivo, { upsert: true });
    if (errorSubida) {
      setErrorFoto('No se pudo subir la foto: ' + errorSubida.message);
      setSubiendoFoto(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(ruta);
    const res = await llamarApiPerfil({ foto_url: urlData.publicUrl });
    if (!res.ok) {
      setErrorFoto('La foto se subió pero no se pudo guardar en tu perfil.');
    }
    await cargar();
    setSubiendoFoto(false);
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorPassword('');
    setMensajePassword('');
    if (password.length < 6) {
      setErrorPassword('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setErrorPassword('Las contraseñas no coinciden.');
      return;
    }
    setGuardandoPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setGuardandoPassword(false);
    if (error) {
      setErrorPassword(error.message);
      return;
    }
    setPassword('');
    setPassword2('');
    setMensajePassword('Contraseña actualizada.');
  }

  if (cargando) return <p className="text-frost-500">Cargando...</p>;
  if (!perfil) return <p className="text-frost-500">No se pudo cargar tu perfil.</p>;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-frost-800 mb-5">Mi perfil</h1>

      <div className="bg-white rounded-card border border-frost-100 p-5 mb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-frost-100 overflow-hidden flex items-center justify-center text-frost-400 text-2xl shrink-0">
            {perfil.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              (perfil.nombre ?? perfil.nombre_usuario ?? '?').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 cursor-pointer hover:bg-frost-50 inline-block">
              {subiendoFoto ? 'Subiendo...' : 'Cambiar foto'}
              <input type="file" accept="image/*" className="hidden" onChange={subirFoto} disabled={subiendoFoto} />
            </label>
            {errorFoto && <p className="text-red-600 text-xs mt-1">{errorFoto}</p>}
          </div>
        </div>

        <p className="text-xs text-frost-400 mb-4">
          Usuario: <span className="font-medium text-frost-600">{perfil.nombre_usuario}</span> · Rol: {perfil.rol}
        </p>

        <form onSubmit={guardarDatos} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-frost-500 uppercase">Nombre y apellido</label>
            <input className="input-field mt-1" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-frost-500 uppercase">Teléfono celular</label>
            <input className="input-field mt-1" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          {mensajeDatos && <p className="text-green-600 text-sm">{mensajeDatos}</p>}
          <button type="submit" disabled={guardandoDatos} className="btn-primary">
            {guardandoDatos ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-card border border-frost-100 p-5">
        <h2 className="font-display text-lg text-frost-800 mb-3">Cambiar contraseña</h2>
        <form onSubmit={cambiarPassword} className="space-y-3">
          <input
            type="password"
            placeholder="Nueva contraseña"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Repetir contraseña"
            className="input-field"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
          {errorPassword && <p className="text-red-600 text-sm">{errorPassword}</p>}
          {mensajePassword && <p className="text-green-600 text-sm">{mensajePassword}</p>}
          <button type="submit" disabled={guardandoPassword} className="btn-primary">
            {guardandoPassword ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>

      <div className="bg-frost-50 border border-frost-200 rounded-card p-4 mt-5">
        <p className="text-sm text-frost-600 font-medium mb-1">Notificaciones al celular</p>
        <p className="text-xs text-frost-500">
          Todavía no están disponibles — quedaron para una próxima actualización.
        </p>
      </div>
    </div>
  );
}
