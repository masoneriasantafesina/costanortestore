'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setVerificando(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/admin/login');
      } else {
        setVerificando(false);
      }
    });
  }, [pathname, router]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (verificando) return <div className="p-6 text-frost-500">Verificando sesión...</div>;

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  const links = [
    { href: '/admin/pedidos', label: 'Pedidos' },
    { href: '/admin/venta-directa', label: 'Venta Directa' },
    { href: '/admin/clientes', label: 'Clientes' },
    { href: '/admin/productos', label: 'Productos' },
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
