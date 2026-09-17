'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [verificando, setVerificando] = useState(true);
  const [rol, setRol] = useState<'administrador' | 'operador' | 'nuevo' | null>(null);
  const [usuarioActual, setUsuarioActual] = useState<{ nombre: string | null; email: string } | null>(null);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setVerificando(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push('/admin/login');
        return;
      }
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol, nombre, email')
        .eq('id', data.session.user.id)
        .single();

      // Si no existe fila de perfil (cuentas viejas, de antes de este
      // sistema de roles), lo dejamos pasar con acceso normal en vez de
      // bloquearlo por una situación que él no generó.
      setRol((perfil?.rol as any) ?? 'operador');
      setUsuarioActual({
        nombre: perfil?.nombre ?? null,
        email: perfil?.email ?? data.session.user.email ?? '',
      });
      setVerificando(false);
    });
  }, [pathname, router]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (verificando) return <div className="p-6 text-frost-500">Verificando sesión...</div>;

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  if (rol === 'nuevo') {
    return <PantallaSinAcceso onCerrarSesion={cerrarSesion} />;
  }

  const links = [
    { href: '/admin/pedidos', label: 'Pedidos' },
    { href: '/admin/venta-directa', label: 'Venta Directa' },
    { href: '/admin/clientes', label: 'Clientes' },
    { href: '/admin/productos', label: 'Productos' },
    { href: '/admin/usuarios', label: 'Usuarios' },
  ];

  return (
    <div className="min-h-screen bg-frost-50">
      <header className="bg-frost-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-display text-lg">Grido · Panel admin</span>
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-card text-sm font-medium ${
                  pathname.startsWith(l.href) ? 'bg-mango-500' : 'hover:bg-frost-700'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <span className="px-3 py-1.5 text-sm text-frost-300">
              {usuarioActual?.nombre || usuarioActual?.email}
            </span>
            <button onClick={cerrarSesion} className="px-3 py-1.5 text-sm text-frost-300 hover:text-white">
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function PantallaSinAcceso({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMensaje('');

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
    setPassword('');
    setPassword2('');
    setMensaje('Contraseña actualizada.');
  }

  return (
    <div className="min-h-screen bg-frost-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-card p-6 w-full max-w-sm">
        <h1 className="font-display text-xl text-frost-800 mb-2">Cuenta pendiente de aprobación</h1>
        <p className="text-sm text-frost-500 mb-5">
          Ya te registraste, pero todavía no tenés acceso a ninguna sección del sistema. Cuando el
          administrador te asigne un rol, vas a poder entrar normalmente.
        </p>

        <form onSubmit={cambiarPassword} className="space-y-3">
          <label className="text-xs font-semibold text-frost-500 uppercase">Cambiar contraseña</label>
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
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {mensaje && <p className="text-green-600 text-sm">{mensaje}</p>}
          <button type="submit" disabled={guardando} className="btn-primary w-full">
            {guardando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>

        <button onClick={onCerrarSesion} className="text-frost-500 text-sm mt-4 underline">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
