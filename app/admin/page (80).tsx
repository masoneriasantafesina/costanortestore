'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Pedido } from '@/lib/types';

type PedidoResumen = Pick<Pedido, 'id' | 'estado' | 'pagado' | 'creado_en'>;

export default function InicioPage() {
  const [cargando, setCargando] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [esPrimeraVez, setEsPrimeraVez] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data: sesion } = await supabase.auth.getSession();
      const uid = sesion.session?.user.id;
      if (!uid) {
        setCargando(false);
        return;
      }

      const [{ data: perfil }, { data: pedidosData }] = await Promise.all([
        supabase.from('perfiles').select('nombre, email, ultimo_login_en').eq('id', uid).single(),
        supabase.from('pedidos').select('id, estado, pagado, creado_en'),
      ]);

      setNombreUsuario(perfil?.nombre || perfil?.email?.split('@')[0] || '');
      setPedidos(pedidosData ?? []);

      if (perfil?.ultimo_login_en) {
        setCutoff(perfil.ultimo_login_en);
      } else {
        // Primera vez que vemos a este usuario en Inicio: no hay punto de
        // comparación todavía, así que mostramos "hoy" como referencia.
        setEsPrimeraVez(true);
        setCutoff(new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      }

      // Guardamos el momento de esta visita para la próxima vez. Si falla,
      // no pasa nada grave: solo se degrada el contador de "nuevos", el
      // resto del panel sigue funcionando.
      const { error } = await supabase
        .from('perfiles')
        .update({ ultimo_login_en: new Date().toISOString() })
        .eq('id', uid);
      if (error) {
        console.error('No se pudo actualizar ultimo_login_en:', error.message);
      }

      setCargando(false);
    }
    cargar();
  }, []);

  const sinAsignar = pedidos.filter((p) => p.estado === 'nuevo').length;
  const enPreparacion = pedidos.filter((p) => p.estado === 'preparacion').length;
  const preparados = pedidos.filter((p) => p.estado === 'preparado').length;
  const enReparto = pedidos.filter((p) => p.estado === 'reparto').length;
  const enCurso = enPreparacion + preparados + enReparto;
  const pendientesDePago = pedidos.filter((p) => p.estado === 'entregado' && !p.pagado).length;
  const nuevosDesdeUltimoIngreso = cutoff
    ? pedidos.filter((p) => new Date(p.creado_en) > new Date(cutoff)).length
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-frost-800">
          {nombreUsuario ? `Hola, ${nombreUsuario}` : 'Inicio'}
        </h1>
        <p className="text-sm text-frost-500 mt-0.5">Esto es lo que necesitás saber ahora.</p>
      </div>

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <>
          {/* Destacado: nuevos desde el último ingreso */}
          <Link
            href="/admin/pedidos"
            className="block bg-frost-800 text-white rounded-card px-5 py-4 mb-5 hover:bg-frost-700 transition-colors"
          >
            <p className="text-3xl font-display font-bold">{nuevosDesdeUltimoIngreso}</p>
            <p className="text-sm text-frost-200 mt-1">
              {esPrimeraVez
                ? 'Pedidos nuevos hoy'
                : nuevosDesdeUltimoIngreso === 1
                ? 'Pedido nuevo desde tu último ingreso'
                : 'Pedidos nuevos desde tu último ingreso'}
            </p>
          </Link>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <TarjetaResumen
              href="/admin/pedidos"
              valor={sinAsignar}
              etiqueta="Sin procesar"
              detalle="Nuevos, sin asignar"
              color="frost"
            />
            <TarjetaResumen
              href="/admin/pedidos"
              valor={enCurso}
              etiqueta="En curso"
              detalle="Preparación, preparado o en reparto"
              color="sky"
            />
            <TarjetaResumen
              href="/admin/pedidos"
              valor={pendientesDePago}
              etiqueta="Pendientes de pago"
              detalle="Entregados sin cobrar"
              color="mango"
            />
          </div>

          {/* Accesos rápidos */}
          <h2 className="font-display text-lg text-frost-800 mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AccesoRapido href="/admin/pedidos" label="Pedidos" />
            <AccesoRapido href="/admin/venta-directa" label="Venta directa" />
            <AccesoRapido href="/admin/clientes" label="Clientes" />
            <AccesoRapido href="/admin/cobranzas" label="Cobranzas" />
          </div>
        </>
      )}
    </div>
  );
}

function TarjetaResumen({
  href,
  valor,
  etiqueta,
  detalle,
  color,
}: {
  href: string;
  valor: number;
  etiqueta: string;
  detalle: string;
  color: 'frost' | 'sky' | 'mango';
}) {
  const colores = {
    frost: 'text-frost-700',
    sky: 'text-sky-600',
    mango: 'text-mango-600',
  };
  return (
    <Link
      href={href}
      className="bg-white rounded-card border border-frost-100 p-4 hover:border-frost-300 transition-colors"
    >
      <p className={`text-3xl font-display font-bold ${colores[color]}`}>{valor}</p>
      <p className="text-sm font-semibold text-frost-800 mt-1">{etiqueta}</p>
      <p className="text-xs text-frost-400 mt-0.5">{detalle}</p>
    </Link>
  );
}

function AccesoRapido({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-card border border-frost-100 px-4 py-3 text-sm font-medium text-frost-700 text-center hover:bg-frost-50 transition-colors"
    >
      {label}
    </Link>
  );
}
