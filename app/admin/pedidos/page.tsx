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
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: pedidosData }, { data: clientesData }] = await Promise.all([
      supabase
        .from('pedidos')
        .select('*, clientes(*), pedido_items(*)')
        .order('orden', { ascending: true }),
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

  async function cancelarPedido(pedido: Pedido) {
    if (!confirm(`¿Cancelar el pedido #${pedido.numero}? Sale de los tableros activos, pero queda guardado en el historial.`)) {
      return;
    }
    await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', pedido.id);
    await cargarTodo();
    setPedidoAbierto(null);
  }

  async function asignarCliente(pedido: Pedido, clienteId: string) {
    await supabase.from('pedidos').update({ cliente_id: clienteId || null }).eq('id', pedido.id);
    await cargarTodo();
  }

  async function reabrirPedido(pedido: Pedido) {
    await supabase.from('pedidos').update({ estado: 'nuevo' }).eq('id', pedido.id);
    await cargarTodo();
  }

  async function eliminarDefinitivo(pedido: Pedido) {
    if (
      !confirm(
        `Esto borra el pedido #${pedido.numero} para siempre, sin forma de recuperarlo. ¿Seguro?`
      )
    ) {
      return;
    }
    await supabase.from('pedidos').delete().eq('id', pedido.id);
    await cargarTodo();
  }

  async function moverEnColumna(estado: EstadoPedido, draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const columna = pedidos.filter((p) => p.estado === estado).sort((a, b) => a.orden - b.orden);
    const fromIndex = columna.findIndex((p) => p.id === draggedId);
    const toIndex = columna.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordenado = [...columna];
    const [item] = reordenado.splice(fromIndex, 1);
    reordenado.splice(toIndex, 0, item);

    // Actualización optimista en pantalla para que se sienta instantáneo
    setPedidos((prev) => {
      const nuevosOrdenes = new Map(reordenado.map((p, i) => [p.id, i * 10]));
      return prev.map((p) => (nuevosOrdenes.has(p.id) ? { ...p, orden: nuevosOrdenes.get(p.id)! } : p));
    });

    // Persistir en la base de datos
    await Promise.all(
      reordenado.map((p, i) => supabase.from('pedidos').update({ orden: i * 10 }).eq('id', p.id))
    );
  }

  if (cargando) return <p className="text-frost-500">Cargando pedidos...</p>;

  const cancelados = pedidos
    .filter((p) => p.estado === 'cancelado')
    .sort((a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime());

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Pedidos</h1>
        <button
          onClick={() => setMostrarHistorial((v) => !v)}
          className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
        >
          {mostrarHistorial ? 'Ocultar historial' : `Historial (${cancelados.length} cancelados)`}
        </button>
      </div>

      {mostrarHistorial && (
        <div className="bg-white rounded-card border border-frost-100 p-4 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-frost-500 mb-3">
            Pedidos cancelados
          </p>
          {cancelados.length === 0 && <p className="text-sm text-frost-400">No hay pedidos cancelados.</p>}
          <div className="space-y-2">
            {cancelados.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-frost-50 rounded-card p-3"
              >
                <div>
                  <p className="text-sm font-medium text-frost-800">
                    #{p.numero} · {p.clientes?.nombre_comercio ?? p.nombre_contacto}
                  </p>
                  <p className="text-xs text-frost-500">
                    ${p.total.toFixed(2)} · cancelado el{' '}
                    {new Date(p.actualizado_en).toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reabrirPedido(p)}
                    className="text-xs font-medium text-frost-700 border border-frost-200 rounded-card px-2 py-1 hover:bg-white"
                  >
                    Reabrir
                  </button>
                  <button
                    onClick={() => eliminarDefinitivo(p)}
                    className="text-xs font-medium text-red-600 border border-red-200 rounded-card px-2 py-1 hover:bg-red-50"
                  >
                    Eliminar definitivo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {COLUMNAS.map((estado) => {
          const items = pedidos.filter((p) => p.estado === estado).sort((a, b) => a.orden - b.orden);
          return (
            <div key={estado} className="bg-white rounded-card border border-frost-100 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-frost-500 mb-3">
                {ESTADOS_LABEL[estado]} · {items.length}
              </p>
              <div className="space-y-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setArrastrandoId(p.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (arrastrandoId) moverEnColumna(estado, arrastrandoId, p.id);
                      setArrastrandoId(null);
                    }}
                    onDragEnd={() => setArrastrandoId(null)}
                    className={`bg-frost-50 hover:bg-frost-100 rounded-card p-3 transition-colors cursor-move ${
                      arrastrandoId === p.id ? 'opacity-40' : ''
                    }`}
                  >
                    <button onClick={() => setPedidoAbierto(p)} className="w-full text-left">
                      <p className="text-sm font-medium text-frost-800">
                        #{p.numero} · {p.clientes?.nombre_comercio ?? p.nombre_contacto}
                      </p>
                      <p className="text-xs text-frost-500 mt-1">
                        {p.origen === 'catalogo_web' ? 'Catálogo web' : 'Carga manual'} · ${p.total.toFixed(2)}
                      </p>
                    </button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-frost-300">Sin pedidos</p>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-frost-400 mt-4">
        Arrastrá una tarjeta sobre otra dentro de la misma columna para cambiar su orden (por ejemplo, el
        orden de reparto).
      </p>

      {pedidoAbierto && (
        <DetallePedido
          pedido={pedidoAbierto}
          clientes={clientes}
          onCerrar={() => setPedidoAbierto(null)}
          onCambiarEstado={cambiarEstado}
          onAsignarCliente={asignarCliente}
          onCancelar={cancelarPedido}
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
  onCancelar,
}: {
  pedido: Pedido;
  clientes: Cliente[];
  onCerrar: () => void;
  onCambiarEstado: (p: Pedido, e: EstadoPedido) => void;
  onAsignarCliente: (p: Pedido, clienteId: string) => void;
  onCancelar: (p: Pedido) => void;
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

        <div className="flex flex-wrap gap-2 mb-4">
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

        <div className="border-t border-frost-100 pt-3">
          <button
            onClick={() => onCancelar(pedido)}
            className="text-red-600 text-sm font-medium hover:text-red-700"
          >
            Cancelar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
