'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente, EstadoPedido, Pedido, Producto } from '@/lib/types';
import { ESTADOS_LABEL, UNIDAD_NEGOCIO_LABEL, UNIDAD_NEGOCIO_COLOR } from '@/lib/types';

const COLUMNAS: EstadoPedido[] = ['nuevo', 'preparacion', 'preparado', 'reparto'];
const ESTADOS_TRANSICION: EstadoPedido[] = ['nuevo', 'preparacion', 'preparado', 'reparto', 'entregado'];

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pedidoAbierto, setPedidoAbierto] = useState<Pedido | null>(null);
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEntregados, setMostrarEntregados] = useState(false);

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
    // Si hay una ventana de detalle abierta, la refrescamos con el dato
    // recién traído — si no, queda mostrando una copia vieja en memoria
    // hasta que el usuario la cierra y la vuelve a abrir.
    setPedidoAbierto((prev) => {
      if (!prev) return prev;
      return (pedidosData as any)?.find((p: any) => p.id === prev.id) ?? null;
    });
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cambiarEstado(pedido: Pedido, estado: EstadoPedido) {
    if (pedido.estado === 'entregado') return; // terminal: no se puede revertir
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

  async function actualizarCobro(pedido: Pedido, metodo: string, pagado: boolean) {
    await supabase.from('pedidos').update({ metodo_pago: metodo || null, pagado }).eq('id', pedido.id);
    await cargarTodo();
  }

  async function guardarItemsPedido(
    pedido: Pedido,
    items: {
      producto_id: string | null;
      nombre_producto: string;
      precio_unitario: number;
      cantidad: number;
      unidad: string;
      peso_kg: number;
      subtotal: number;
    }[],
    total: number
  ) {
    await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id);
    if (items.length > 0) {
      await supabase.from('pedido_items').insert(items.map((it) => ({ pedido_id: pedido.id, ...it })));
    }
    await supabase
      .from('pedidos')
      .update({ total, actualizado_en: new Date().toISOString() })
      .eq('id', pedido.id);
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

  const pendientesPago = pedidos
    .filter((p) => p.estado === 'entregado' && !p.pagado)
    .sort((a, b) => new Date(a.actualizado_en).getTime() - new Date(b.actualizado_en).getTime());

  const entregadosHistorial = pedidos
    .filter((p) => p.estado === 'entregado' && p.pagado)
    .sort((a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime());

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Pedidos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarEntregados((v) => !v)}
            className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
          >
            {mostrarEntregados ? 'Ocultar entregados' : `Entregados (${entregadosHistorial.length})`}
          </button>
          <button
            onClick={() => setMostrarHistorial((v) => !v)}
            className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
          >
            {mostrarHistorial ? 'Ocultar historial' : `Historial (${cancelados.length} cancelados)`}
          </button>
        </div>
      </div>

      {mostrarEntregados && (
        <div className="bg-white rounded-card border border-frost-100 p-4 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-frost-500 mb-3">
            Pedidos entregados y cobrados
          </p>
          {entregadosHistorial.length === 0 && (
            <p className="text-sm text-frost-400">Todavía no hay pedidos entregados y cobrados.</p>
          )}
          <div className="space-y-2">
            {entregadosHistorial.map((p) => (
              <button
                key={p.id}
                onClick={() => setPedidoAbierto(p)}
                className="w-full flex items-center justify-between bg-frost-50 hover:bg-frost-100 rounded-card p-3 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-frost-800">
                    #{p.numero} · {p.clientes?.nombre_apellido ?? p.nombre_contacto}
                  </p>
                  <p className="text-xs text-frost-500">
                    ${p.total.toFixed(2)} · entregado el {new Date(p.actualizado_en).toLocaleString('es-AR')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
                    #{p.numero} · {p.clientes?.nombre_apellido ?? p.nombre_contacto}
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
                        #{p.numero} · {p.clientes?.nombre_apellido ?? p.nombre_contacto}
                      </p>
                      <p className="text-xs text-frost-500 mt-1">
                        {p.origen === 'catalogo_web' ? 'Catálogo web' : 'Carga manual'} · ${p.total.toFixed(2)}
                      </p>
                      {p.clientes?.unidad_negocio && (
                        <span
                          className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-card mt-1 ${UNIDAD_NEGOCIO_COLOR[p.clientes.unidad_negocio]}`}
                        >
                          {UNIDAD_NEGOCIO_LABEL[p.clientes.unidad_negocio]}
                        </span>
                      )}
                    </button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-frost-300">Sin pedidos</p>}
              </div>
            </div>
          );
        })}

        {/* Columna especial: entregados que todavía no se cobraron */}
        <div className="bg-yellow-50 rounded-card border border-yellow-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-3">
            Pendiente de Pago · {pendientesPago.length}
          </p>
          <div className="space-y-2">
            {pendientesPago.map((p) => (
              <button
                key={p.id}
                onClick={() => setPedidoAbierto(p)}
                className="w-full text-left bg-yellow-100 hover:bg-yellow-200 rounded-card p-3 transition-colors"
              >
                <p className="text-sm font-medium text-yellow-900">
                  #{p.numero} · {p.clientes?.nombre_apellido ?? p.nombre_contacto}
                </p>
                <p className="text-xs text-yellow-700 mt-1">${p.total.toFixed(2)}</p>
                {p.clientes?.unidad_negocio && (
                  <span
                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-card mt-1 ${UNIDAD_NEGOCIO_COLOR[p.clientes.unidad_negocio]}`}
                  >
                    {UNIDAD_NEGOCIO_LABEL[p.clientes.unidad_negocio]}
                  </span>
                )}
              </button>
            ))}
            {pendientesPago.length === 0 && <p className="text-xs text-yellow-600">Sin pendientes</p>}
          </div>
        </div>
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
          onActualizarCobro={actualizarCobro}
          onGuardarItems={guardarItemsPedido}
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
  onActualizarCobro,
  onGuardarItems,
}: {
  pedido: Pedido;
  clientes: Cliente[];
  onCerrar: () => void;
  onCambiarEstado: (p: Pedido, e: EstadoPedido) => void;
  onAsignarCliente: (p: Pedido, clienteId: string) => void;
  onCancelar: (p: Pedido) => void;
  onActualizarCobro: (p: Pedido, metodo: string, pagado: boolean) => void;
  onGuardarItems: (
    p: Pedido,
    items: {
      producto_id: string | null;
      nombre_producto: string;
      precio_unitario: number;
      cantidad: number;
      unidad: string;
      peso_kg: number;
      subtotal: number;
    }[],
    total: number
  ) => Promise<void>;
}) {
  const composicionBloqueada = pedido.estado === 'entregado' || pedido.estado === 'cancelado';

  const [editando, setEditando] = useState(false);
  const [guardandoItems, setGuardandoItems] = useState(false);
  const [itemsEdit, setItemsEdit] = useState<
    {
      id: string;
      producto_id: string | null;
      nombre_producto: string;
      precio_unitario: number;
      cantidad: number;
      unidad: string;
      peso_kg: number;
      subtotal: number;
    }[]
  >([]);
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[] | null>(null);
  const [buscarProducto, setBuscarProducto] = useState('');

  function iniciarEdicion() {
    setItemsEdit(
      (pedido.pedido_items ?? []).map((it) => ({
        id: it.id,
        producto_id: it.producto_id,
        nombre_producto: it.nombre_producto,
        precio_unitario: it.precio_unitario,
        cantidad: it.cantidad,
        unidad: it.unidad,
        peso_kg: it.peso_kg ?? 0,
        subtotal: it.subtotal,
      }))
    );
    setEditando(true);
    if (!productosDisponibles) {
      const marca = pedido.clientes?.unidad_negocio === 'via_vana' ? 'via_vana' : 'grido';
      supabase
        .from('productos')
        .select('*')
        .eq('marca', marca)
        .order('nombre')
        .then(({ data }) => setProductosDisponibles(data ?? []));
    }
  }

  function agregarProducto(p: Producto) {
    setItemsEdit((prev) => {
      const existente = prev.find((it) => it.producto_id === p.id);
      const precio = p.precio_promo ?? p.precio_normal;
      if (existente) {
        return prev.map((it) =>
          it.producto_id === p.id
            ? { ...it, cantidad: it.cantidad + 1, subtotal: (it.cantidad + 1) * it.precio_unitario }
            : it
        );
      }
      return [
        ...prev,
        {
          id: `nuevo-${p.id}-${Date.now()}`,
          producto_id: p.id,
          nombre_producto: p.nombre,
          precio_unitario: precio,
          cantidad: 1,
          unidad: p.unidad,
          peso_kg: p.peso_kg ?? 0,
          subtotal: precio,
        },
      ];
    });
  }

  function cambiarCantidadEdit(id: string, delta: number) {
    setItemsEdit((prev) => {
      const actualizado = prev
        .map((it) => {
          if (it.id !== id) return it;
          const nuevaCantidad = it.cantidad + delta;
          if (nuevaCantidad <= 0) return null;
          return { ...it, cantidad: nuevaCantidad, subtotal: nuevaCantidad * it.precio_unitario };
        })
        .filter((it): it is NonNullable<typeof it> => it !== null);
      return actualizado;
    });
  }

  function quitarItem(id: string) {
    setItemsEdit((prev) => prev.filter((it) => it.id !== id));
  }

  const totalEdit = itemsEdit.reduce((acc, it) => acc + it.subtotal, 0);

  async function guardarEdicion() {
    setGuardandoItems(true);
    await onGuardarItems(
      pedido,
      itemsEdit.map((it) => ({
        producto_id: it.producto_id,
        nombre_producto: it.nombre_producto,
        precio_unitario: it.precio_unitario,
        cantidad: it.cantidad,
        unidad: it.unidad,
        peso_kg: it.peso_kg,
        subtotal: it.subtotal,
      })),
      totalEdit
    );
    setGuardandoItems(false);
    setEditando(false);
  }

  const productosFiltrados = (productosDisponibles ?? []).filter((p) =>
    p.nombre.toLowerCase().includes(buscarProducto.toLowerCase())
  );

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
          <div className="flex items-center gap-2 mt-1">
            <select
              className="input-field"
              value={pedido.cliente_id ?? ''}
              onChange={(e) => onAsignarCliente(pedido, e.target.value)}
            >
              <option value="">Sin asignar ({pedido.nombre_contacto})</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_apellido} ({UNIDAD_NEGOCIO_LABEL[c.unidad_negocio]})
                </option>
              ))}
            </select>
            {pedido.clientes?.unidad_negocio && (
              <span
                className={`shrink-0 text-xs font-semibold px-2 py-1.5 rounded-card ${UNIDAD_NEGOCIO_COLOR[pedido.clientes.unidad_negocio]}`}
              >
                {UNIDAD_NEGOCIO_LABEL[pedido.clientes.unidad_negocio]}
              </span>
            )}
          </div>
          <p className="text-xs text-frost-400 mt-1">
            Contacto original: {pedido.nombre_contacto} · {pedido.telefono_contacto}
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-frost-500 uppercase">
              Productos {composicionBloqueada && '(no editable)'}
            </label>
            {!composicionBloqueada && !editando && (
              <button
                onClick={iniciarEdicion}
                className="text-xs font-medium text-frost-600 border border-frost-200 rounded-card px-2 py-1 hover:bg-frost-50"
              >
                Editar pedido
              </button>
            )}
          </div>

          {!editando ? (
            <>
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
              <div className="flex justify-between text-xs text-frost-400 mt-1">
                <span>Peso total</span>
                <span>
                  {(pedido.pedido_items ?? [])
                    .reduce((acc, item) => acc + item.cantidad * (item.peso_kg ?? 0), 0)
                    .toFixed(2)}{' '}
                  kg
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 bg-frost-50 rounded-card p-3">
              <div className="space-y-2 mb-3">
                {itemsEdit.map((it) => (
                  <div key={it.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-frost-700 truncate">{it.nombre_producto}</span>
                    <button
                      onClick={() => cambiarCantidadEdit(it.id, -1)}
                      className="w-6 h-6 rounded-card bg-white border border-frost-200 text-frost-700 text-sm"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs">{it.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidadEdit(it.id, 1)}
                      className="w-6 h-6 rounded-card bg-white border border-frost-200 text-frost-700 text-sm"
                    >
                      +
                    </button>
                    <span className="text-xs text-frost-600 w-16 text-right">${it.subtotal.toFixed(2)}</span>
                    <button
                      onClick={() => quitarItem(it.id)}
                      className="text-red-500 text-xs px-1"
                      title="Quitar producto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {itemsEdit.length === 0 && (
                  <p className="text-xs text-frost-400">Sin productos — agregá al menos uno.</p>
                )}
              </div>

              <div className="flex justify-between text-sm font-semibold text-frost-800 border-t border-frost-200 pt-2 mb-3">
                <span>Total</span>
                <span>${totalEdit.toFixed(2)}</span>
              </div>

              <input
                placeholder="Buscar producto para agregar..."
                className="input-field text-sm mb-2"
                value={buscarProducto}
                onChange={(e) => setBuscarProducto(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                {productosDisponibles === null && <p className="text-xs text-frost-400">Cargando productos...</p>}
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="w-full flex justify-between text-left text-xs bg-white hover:bg-frost-100 rounded-card px-2 py-1.5"
                  >
                    <span>{p.nombre}</span>
                    <span className="text-frost-500">${(p.precio_promo ?? p.precio_normal).toFixed(2)}</span>
                  </button>
                ))}
                {productosDisponibles !== null && productosFiltrados.length === 0 && (
                  <p className="text-xs text-frost-400">Sin resultados.</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditando(false)}
                  className="px-3 py-1.5 text-xs text-frost-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarEdicion}
                  disabled={guardandoItems || itemsEdit.length === 0}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {guardandoItems ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-frost-500 uppercase">Cobro</label>
          <select
            className="input-field mt-1"
            value={pedido.metodo_pago ?? ''}
            onChange={(e) =>
              onActualizarCobro(pedido, e.target.value, e.target.value === 'pendiente_pago' ? false : true)
            }
          >
            <option value="">Sin definir</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="pendiente_pago">Pendiente de Pago</option>
            <option value="cheque">Cheque</option>
            <option value="mixto">Mixto</option>
          </select>
          {pedido.metodo_pago === 'pendiente_pago' && (
            <label className="flex items-center gap-2 text-sm text-frost-700 mt-2">
              <input
                type="checkbox"
                checked={pedido.pagado}
                onChange={(e) => onActualizarCobro(pedido, pedido.metodo_pago!, e.target.checked)}
              />
              Ya lo pagó
            </label>
          )}
        </div>

        {pedido.estado === 'entregado' ? (
          <div className="border-t border-frost-100 pt-3">
            <p className="text-sm text-frost-500">
              Este pedido ya fue entregado y no se puede volver a un estado anterior ni cancelar.
              {!pedido.pagado && ' Todavía figura como pendiente de pago.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {ESTADOS_TRANSICION.map((estado) => (
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
          </>
        )}
      </div>
    </div>
  );
}
