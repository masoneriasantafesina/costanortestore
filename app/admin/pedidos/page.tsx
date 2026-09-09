'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente, EstadoPedido, Pedido } from '@/lib/types';
import { ESTADOS_LABEL } from '@/lib/types';

const COLUMNAS: EstadoPedido[] = ['nuevo', 'preparacion', 'preparado', 'reparto', 'entregado'];

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pedidoAbierto, setPedidoAbierto] = useState<Pedido | null>(null);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: pedidosData }, { data: clientesData }] = await Promise.all([
      supabase
        .from('pedidos')
        .select('*, clientes(*), pedido_items(*)')
        .order('creado_en', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre_apellido'),
    ]);
    setPedidos((pedidosData as any) ?? []);
    setClientes(clientesData ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cambiarEstado(pedido: Pedido, estado: EstadoPedido) {
    await supabase.from('pedidos').update({ estado, actualizado_en: new Date().toISOString() }).eq('id', pedido.id);
    await cargarTodo();
    setPedidoAbierto(null);
  }

  async function asignarCliente(pedido: Pedido, clienteId: string) {
    await supabase.from('pedidos').update({ cliente_id: clienteId || null }).eq('id', pedido.id);
    await cargarTodo();
  }

  if (cargando) return <p className="text-frost-500">Cargando pedidos...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl text-frost-800 mb-5">Pedidos</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {COLUMNAS.map((estado) => {
          const items = pedidos.filter((p) => p.estado === estado);
          return (
            <div key={estado} className="bg-white rounded-card border border-frost-100 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-frost-500 mb-3">
                {ESTADOS_LABEL[estado]} · {items.length}
              </p>
              <div className="space-y-2">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPedidoAbierto(p)}
                    className="w-full text-left bg-frost-50 hover:bg-frost-100 rounded-card p-3 transition-colors"
                  >
                    <p className="text-sm font-medium text-frost-800">
                      #{p.numero} · {p.clientes?.nombre_comercio ?? p.nombre_contacto}
                    </p>
                    <p className="text-xs text-frost-500 mt-1">
                      {p.origen === 'catalogo_web' ? 'Catálogo web' : 'Carga manual'} · ${p.total.toFixed(2)}
                    </p>
                  </button>
                ))}
                {items.length === 0 && <p className="text-xs text-frost-300">Sin pedidos</p>}
              </div>
            </div>
          );
        })}
      </div>

      {pedidoAbierto && (
        <DetallePedido
          pedido={pedidoAbierto}
          clientes={clientes}
          onCerrar={() => setPedidoAbierto(null)}
          onCambiarEstado={cambiarEstado}
          onAsignarCliente={asignarCliente}
        />
      )}
    </div>
  );
}

function DetallePedido({
  pedido,
  clientes,
  onCerrar,
  onCambiarEstado,
  onAsignarCliente,
}: {
  pedido: Pedido;
  clientes: Cliente[];
  onCerrar: () => void;
  onCambiarEstado: (p: Pedido, e: EstadoPedido) => void;
  onAsignarCliente: (p: Pedido, clienteId: string) => void;
}) {
  const composicionBloqueada = ['preparado', 'reparto', 'entregado'].includes(pedido.estado);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative bg-white rounded-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-xl text-frost-800">Pedido #{pedido.numero}</h2>
            <p className="text-xs text-frost-500">
              {new Date(pedido.creado_en).toLocaleString('es-AR')}
            </p>
          </div>
          <button onClick={onCerrar} className="text-frost-400 text-sm">
            Cerrar
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-frost-500 uppercase">Cliente asignado</label>
          <select
            className="input-field mt-1"
            value={pedido.cliente_id ?? ''}
            onChange={(e) => onAsignarCliente(pedido, e.target.value)}
          >
            <option value="">Sin asignar ({pedido.nombre_contacto})</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_comercio || c.nombre_apellido}
              </option>
            ))}
          </select>
          <p className="text-xs text-frost-400 mt-1">
            Contacto original: {pedido.nombre_contacto} · {pedido.telefono_contacto}
          </p>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-frost-500 uppercase">
            Productos {composicionBloqueada && '(bloqueado)'}
          </label>
          <div className="mt-2 space-y-1">
            {pedido.pedido_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-frost-700">
                <span>
                  {item.cantidad} × {item.nombre_producto}
                </span>
                <span>${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold text-frost-800 border-t border-frost-100 mt-2 pt-2">
            <span>Total</span>
            <span>${pedido.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {COLUMNAS.map((estado) => (
            <button
              key={estado}
              onClick={() => onCambiarEstado(pedido, estado)}
              className={`px-3 py-1.5 rounded-card text-xs font-medium border ${
                pedido.estado === estado
                  ? 'bg-frost-700 text-white border-frost-700'
                  : 'border-frost-200 text-frost-700'
              }`}
            >
              {ESTADOS_LABEL[estado]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
