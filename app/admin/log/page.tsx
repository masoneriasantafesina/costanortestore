'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Entrada = {
  id: string;
  usuario_email: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: string | null;
  creado_en: string;
};

const ACCION_LABEL: Record<string, string> = {
  crear_pedido: 'Pedido creado',
  cancelar_pedido: 'Pedido cancelado',
  eliminar_pedido: 'Pedido eliminado',
  actualizar_cobro: 'Cobro actualizado',
  editar_items_pedido: 'Productos del pedido editados',
  crear_producto: 'Producto creado',
  editar_producto: 'Producto editado',
  editar_precio: 'Precio editado (masivo)',
  eliminar_producto: 'Producto eliminado',
};

export default function LogPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [filtroEntidad, setFiltroEntidad] = useState<'todas' | 'pedido' | 'producto'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(100);

  async function cargar() {
    setCargando(true);
    let query = supabase
      .from('log_auditoria')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(limite);

    if (filtroEntidad !== 'todas') {
      query = query.eq('entidad', filtroEntidad);
    }

    const { data, error } = await query;

    // Si el usuario no es administrador, RLS le devuelve una lista vacía
    // (no un error) — así que un resultado vacío en la primera carga, sin
    // filtros aplicados, es la señal de que no tiene permiso.
    if (error) {
      setSinPermiso(true);
    } else if ((data ?? []).length === 0 && filtroEntidad === 'todas' && !busqueda) {
      setSinPermiso(true);
    }

    setEntradas((data as any) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, [filtroEntidad, limite]);

  const filtradas = entradas.filter(
    (e) =>
      !busqueda ||
      (e.detalle ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (e.usuario_email ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-frost-800 mb-5">Log de auditoría</h1>

      {sinPermiso && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-card px-4 py-3 mb-4">
          Esta sección es solo para administradores, o todavía no hay registros. Si creés que
          deberías ver más, pedile a un administrador que te asigne ese rol desde "Usuarios".
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          placeholder="Buscar por texto o usuario..."
          className="input-field sm:max-w-xs"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="flex gap-2">
          {(['todas', 'pedido', 'producto'] as const).map((valor) => (
            <button
              key={valor}
              onClick={() => setFiltroEntidad(valor)}
              className={`px-3 py-2 rounded-card text-sm font-medium ${
                filtroEntidad === valor
                  ? 'bg-frost-700 text-white'
                  : 'bg-white text-frost-700 border border-frost-200'
              }`}
            >
              {valor === 'todas' ? 'Todas' : valor === 'pedido' ? 'Pedidos' : 'Productos'}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-card border border-frost-100 divide-y divide-frost-100">
          {filtradas.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-frost-800">
                  {ACCION_LABEL[e.accion] ?? e.accion}
                </span>
                <span className="text-xs text-frost-400">
                  {new Date(e.creado_en).toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-sm text-frost-600">{e.detalle}</p>
              <p className="text-xs text-frost-400 mt-1">{e.usuario_email ?? 'desconocido'}</p>
            </div>
          ))}
          {filtradas.length === 0 && !sinPermiso && (
            <p className="p-4 text-sm text-frost-400">No hay registros todavía.</p>
          )}
        </div>
      )}

      {!cargando && entradas.length === limite && (
        <button
          onClick={() => setLimite((l) => l + 100)}
          className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-2 mt-4 hover:bg-frost-50"
        >
          Cargar más
        </button>
      )}
    </div>
  );
}
