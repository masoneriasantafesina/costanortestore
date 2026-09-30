'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

function Icono({ path, className = 'w-5 h-5' }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

const RUTA_ICONO: Record<string, string> = {
  pedidos: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12h6M9 16h6',
  venta: 'M6 6h15l-1.5 9h-12L6 6Zm0 0-1-3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  clientes: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75',
  productos: 'M21 8 12 3 3 8m18 0-9 5m9-5v9l-9 5m0-9L3 8m9 5v9M3 8v9l9 5',
  estadisticas: 'M4 20V10m6 10V4m6 16v-7',
  mas: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  cerrarX: 'M6 6l12 12M18 6 6 18',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m6 14 5-5-5-5m5 5H9',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 3-2 2 2 2m-2-2h-6',
  log: 'M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2ZM9 8h1m-1 4h6m-6 4h6',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [verificando, setVerificando] = useState(true);
  const [rol, setRol] = useState<'administrador' | 'operador' | 'nuevo' | null>(null);
  const [usuarioActual, setUsuarioActual] = useState<{
    nombre: string | null;
    email: string;
    foto_url: string | null;
  } | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

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
        .select('rol, nombre, email, foto_url')
        .eq('id', data.session.user.id)
        .single();

      // Si no existe fila de perfil (cuentas viejas, de antes de este
      // sistema de roles), lo dejamos pasar con acceso normal en vez de
      // bloquearlo por una situación que él no generó.
      setRol((perfil?.rol as any) ?? 'operador');
      setUsuarioActual({
        nombre: perfil?.nombre ?? null,
        email: perfil?.email ?? data.session.user.email ?? '',
        foto_url: perfil?.foto_url ?? null,
      });
      setVerificando(false);
    });
  }, [pathname, router]);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-frost-50">
        <p className="text-frost-400 text-sm">Verificando sesión...</p>
      </div>
    );
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  if (rol === 'nuevo') {
    return <PantallaSinAcceso onCerrarSesion={cerrarSesion} />;
  }

  const linksPrincipales = [
    { href: '/admin/pedidos', label: 'Pedidos', icono: 'pedidos' },
    { href: '/admin/venta-directa', label: 'Venta directa', icono: 'venta' },
    { href: '/admin/clientes', label: 'Clientes', icono: 'clientes' },
    { href: '/admin/productos', label: 'Productos', icono: 'productos' },
  ];

  const linksSecundarios = [
    { href: '/admin/estadisticas', label: 'Estadísticas', icono: 'estadisticas' },
    ...(rol === 'administrador' ? [{ href: '/admin/usuarios', label: 'Usuarios', icono: 'usuarios' }] : []),
    ...(rol === 'administrador' ? [{ href: '/admin/log', label: 'Log de auditoría', icono: 'log' }] : []),
  ];

  const todosLosLinks = [...linksPrincipales, ...linksSecundarios];
  const iniciales = (usuarioActual?.nombre || usuarioActual?.email || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-frost-50">
      {/* Header */}
      <header className="bg-frost-800 text-white print:hidden sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-display text-lg tracking-tight">Grido · Panel admin</span>

          {/* Nav de escritorio */}
          <nav className="hidden md:flex items-center gap-1">
            {todosLosLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-card text-sm font-medium transition-colors ${
                  pathname.startsWith(l.href) ? 'bg-mango-500 text-frost-900' : 'text-frost-100 hover:bg-frost-700'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="w-px h-6 bg-frost-600 mx-2" />
            <Avatar usuarioActual={usuarioActual} iniciales={iniciales} activo={pathname.startsWith('/admin/perfil')} />
            <button
              onClick={cerrarSesion}
              className="ml-1 p-2 rounded-card text-frost-300 hover:text-white hover:bg-frost-700 transition-colors"
              title="Salir"
            >
              <Icono path={RUTA_ICONO.salir} />
            </button>
          </nav>

          {/* Botón hamburguesa (mobile) */}
          <button
            className="md:hidden p-2 -mr-2 rounded-card hover:bg-frost-700"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
          >
            <Icono path={RUTA_ICONO.mas} className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>

      {/* Barra inferior (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-frost-100 print:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {linksPrincipales.map((l) => {
            const activo = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 ${
                  activo ? 'text-mango-600' : 'text-frost-400'
                }`}
              >
                <Icono path={RUTA_ICONO[l.icono]} className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{l.label.split(' ')[0]}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMenuAbierto(true)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 ${
              menuAbierto || linksSecundarios.some((l) => pathname.startsWith(l.href)) || pathname.startsWith('/admin/perfil')
                ? 'text-mango-600'
                : 'text-frost-400'
            }`}
          >
            <Icono path={RUTA_ICONO.mas} className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* Menú deslizable (mobile) */}
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[85%] bg-white shadow-xl flex flex-col animate-in slide-in-from-right">
            <div className="bg-frost-800 text-white px-5 pt-6 pb-5 flex items-start justify-between">
              <Link href="/admin/perfil" className="flex items-center gap-3" onClick={() => setMenuAbierto(false)}>
                <Avatar usuarioActual={usuarioActual} iniciales={iniciales} grande />
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {usuarioActual?.nombre || usuarioActual?.email}
                  </p>
                  <p className="text-xs text-frost-300">Mi perfil</p>
                </div>
              </Link>
              <button onClick={() => setMenuAbierto(false)} className="p-1 -mt-1 -mr-1">
                <Icono path={RUTA_ICONO.cerrarX} className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {linksSecundarios.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-3 px-5 py-3 text-sm font-medium ${
                    pathname.startsWith(l.href) ? 'text-mango-600 bg-mango-50' : 'text-frost-700'
                  }`}
                >
                  <Icono path={RUTA_ICONO[l.icono]} className="w-5 h-5" />
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-frost-100 p-3">
              <button
                onClick={cerrarSesion}
                className="w-full flex items-center gap-3 px-2 py-3 text-sm font-medium text-red-600 rounded-card hover:bg-red-50"
              >
                <Icono path={RUTA_ICONO.salir} className="w-5 h-5" />
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({
  usuarioActual,
  iniciales,
  activo,
  grande,
}: {
  usuarioActual: { nombre: string | null; email: string; foto_url: string | null } | null;
  iniciales: string;
  activo?: boolean;
  grande?: boolean;
}) {
  const tam = grande ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  return (
    <div
      className={`${tam} rounded-full overflow-hidden flex items-center justify-center font-semibold shrink-0 ${
        activo ? 'ring-2 ring-mango-500' : ''
      } ${usuarioActual?.foto_url ? '' : 'bg-frost-600 text-white'}`}
    >
      {usuarioActual?.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={usuarioActual.foto_url} alt="" className="w-full h-full object-cover" />
      ) : (
        iniciales
      )}
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
      <div className="bg-white rounded-card p-6 w-full max-w-sm shadow-sm border border-frost-100">
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
