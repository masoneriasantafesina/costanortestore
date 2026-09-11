'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente, Producto } from '@/lib/types';
import { UNIDAD_NEGOCIO_LABEL, UNIDAD_NEGOCIO_COLOR, MARCA_PRODUCTO_LABEL } from '@/lib/types';

type ItemCarrito = { producto: Producto; cantidad: number };

function marcaDeCliente(unidad: Cliente['unidad_negocio']): 'grido' | 'via_vana' {
  return unidad === 'via_vana' ? 'via_vana' : 'grido';
}

export default function VentaDirectaPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [categoria, setCategoria] = useState('todas');

  const [carrito, setCarrito] = useState<Record<string, ItemCarrito>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    supabase
      .from('clientes')
      .select('*')
      .eq('estado_cliente', 'confirmado')
      .order('nombre_apellido')
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  useEffect(() => {
    if (!clienteSeleccionado) {
      setProductos([]);
      return;
    }
    setCargandoProductos(true);
    const marca = marcaDeCliente(clienteSeleccionado.unidad_negocio);
    supabase
      .from('productos')
      .select('*')
      .eq('marca', marca)
      .order('nombre')
      .then(({ data }) => {
        setProductos(data ?? []);
        setCargandoProductos(false);
      });
  }, [clienteSeleccionado]);

  const clientesFiltrados = clientes.filter((c) =>
    `${c.nombre_apellido} ${c.nombre_comercio}`.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]);
    return ['todas', ...Array.from(set)];
  }, [productos]);

  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria = categoria === 'todas' || p.categoria === categoria;
    const coincideBusqueda = p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  function agregarAlCarrito(producto: Producto) {
    setEnviado(false);
    setCarrito((prev) => {
      const existente = prev[producto.id];
      return {
        ...prev,
        [producto.id]: { producto, cantidad: existente ? existente.cantidad + 1 : 1 },
      };
    });
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito((prev) => {
      const actual = prev[id];
      if (!actual) return prev;
      const nuevaCantidad = actual.cantidad + delta;
      if (nuevaCantidad <= 0) {
        const { [id]: _omit, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: { ...actual, cantidad: nuevaCantidad } };
    });
  }

  const itemsCarrito = Object.values(carrito);
  const totalCarrito = itemsCarrito.reduce((acc, item) => {
    const precio = item.producto.precio_promo ?? item.producto.precio_normal;
    return acc + precio * item.cantidad;
  }, 0);

  function cambiarCliente(c: Cliente | null) {
    setClienteSeleccionado(c);
    setCarrito({});
    setEnviado(false);
    setBusquedaProducto('');
    setCategoria('todas');
  }

  async function confirmarPedido() {
    if (!clienteSeleccionado || itemsCarrito.length === 0) return;
    setEnviando(true);

    const total = totalCarrito;

    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert({
        origen: 'carga_manual',
        estado: 'nuevo',
        cliente_id: clienteSeleccionado.id,
        nombre_contacto: clienteSeleccionado.nombre_apellido,
        telefono_contacto: clienteSeleccionado.telefono ?? '',
        direccion_contacto: clienteSeleccionado.direccion,
        total,
      })
      .select()
      .single();

    if (errorPedido || !pedido) {
      alert('No se pudo crear el pedido: ' + (errorPedido?.message ?? 'error desconocido'));
      setEnviando(false);
      return;
    }

    const itemsAInsertar = itemsCarrito.map((item) => ({
      pedido_id: pedido.id,
      producto_id: item.producto.id,
      nombre_producto: item.producto.nombre,
      precio_unitario: item.producto.precio_promo ?? item.producto.precio_normal,
      cantidad: item.cantidad,
      unidad: item.producto.unidad,
      peso_kg: item.producto.peso_kg ?? 0,
      subtotal: (item.producto.precio_promo ?? item.producto.precio_normal) * item.cantidad,
    }));

    const { error: errorItems } = await supabase.from('pedido_items').insert(itemsAInsertar);

    setEnviando(false);

    if (errorItems) {
      alert('El pedido se creó pero hubo un error guardando los productos: ' + errorItems.message);
      return;
    }

    setCarrito({});
    setEnviado(true);
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-frost-800 mb-5">Venta Directa</h1>

      {/* Paso 1: elegir cliente */}
      {!clienteSeleccionado ? (
        <div className="bg-white rounded-card border border-frost-100 p-4">
          <label className="text-xs font-semibold text-frost-500 uppercase">Elegí el cliente</label>
          <input
            autoFocus
            placeholder="Buscar cliente por nombre o comercio..."
            className="input-field mt-1 mb-3"
            value={busquedaCliente}
            onChange={(e) => setBusquedaCliente(e.target.value)}
          />
          <div className="divide-y divide-frost-100 max-h-96 overflow-y-auto">
            {clientesFiltrados.map((c) => (
              <button
                key={c.id}
                onClick={() => cambiarCliente(c)}
                className="w-full flex items-center justify-between py-2.5 text-left hover:bg-frost-50 px-2 rounded-card"
              >
                <div>
                  <p className="text-sm font-medium text-frost-800">{c.nombre_apellido}</p>
                  <p className="text-xs text-frost-500">{c.nombre_comercio || 'Sin nombre de comercio'}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-card ${UNIDAD_NEGOCIO_COLOR[c.unidad_negocio]}`}
                >
                  {UNIDAD_NEGOCIO_LABEL[c.unidad_negocio]}
                </span>
              </button>
            ))}
            {clientesFiltrados.length === 0 && (
              <p className="text-sm text-frost-400 py-4">Sin resultados.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Cliente elegido */}
          <div className="bg-white rounded-card border border-frost-100 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-frost-800">{clienteSeleccionado.nombre_apellido}</p>
              <p className="text-xs text-frost-500">
                {clienteSeleccionado.nombre_comercio || 'Sin nombre de comercio'} · Marca:{' '}
                {MARCA_PRODUCTO_LABEL[marcaDeCliente(clienteSeleccionado.unidad_negocio)]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-card ${UNIDAD_NEGOCIO_COLOR[clienteSeleccionado.unidad_negocio]}`}
              >
                {UNIDAD_NEGOCIO_LABEL[clienteSeleccionado.unidad_negocio]}
              </span>
              <button
                onClick={() => cambiarCliente(null)}
                className="text-xs font-medium text-frost-600 border border-frost-200 rounded-card px-2 py-1 hover:bg-frost-50"
              >
                Cambiar cliente
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Productos */}
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  placeholder="Buscar producto..."
                  className="input-field sm:max-w-xs"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                />
                <div className="flex gap-2 overflow-x-auto">
                  {categorias.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoria(cat)}
                      className={`whitespace-nowrap px-3 py-2 rounded-card text-sm font-medium ${
                        categoria === cat
                          ? 'bg-frost-700 text-white'
                          : 'bg-white text-frost-700 border border-frost-200'
                      }`}
                    >
                      {cat === 'todas' ? 'Todas' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {cargandoProductos && <p className="text-frost-500 text-sm">Cargando productos...</p>}
              {!cargandoProductos && productosFiltrados.length === 0 && (
                <p className="text-frost-500 text-sm">
                  No hay productos de marca {MARCA_PRODUCTO_LABEL[marcaDeCliente(clienteSeleccionado.unidad_negocio)]} cargados
                  todavía.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productosFiltrados.map((p) => {
                  const precio = p.precio_promo ?? p.precio_normal;
                  return (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      className="text-left bg-white rounded-card border border-frost-100 overflow-hidden hover:border-frost-300"
                    >
                      <div className="aspect-square bg-frost-50">
                        {p.foto_url ? (
                          <img src={p.foto_url} alt={p.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-frost-300 text-xs">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-frost-800 leading-snug">{p.nombre}</p>
                        <p className="text-xs text-mango-600 font-semibold mt-0.5">${precio.toFixed(2)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Carrito */}
            <div className="bg-white rounded-card border border-frost-100 p-4 h-fit sticky top-4">
              <h2 className="font-display text-lg text-frost-800 mb-3">Pedido</h2>

              {enviado ? (
                <div className="text-center py-6">
                  <p className="text-sm font-semibold text-frost-800">¡Pedido cargado!</p>
                  <p className="text-xs text-frost-500 mt-1">
                    Ya está en el tablero de Pedidos, columna "Nuevo".
                  </p>
                  <button onClick={() => cambiarCliente(null)} className="btn-primary mt-4 text-sm">
                    Cargar otro pedido
                  </button>
                </div>
              ) : itemsCarrito.length === 0 ? (
                <p className="text-sm text-frost-400">Tocá un producto para agregarlo.</p>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                    {itemsCarrito.map((item) => {
                      const precio = item.producto.precio_promo ?? item.producto.precio_normal;
                      return (
                        <div key={item.producto.id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-frost-800 truncate">{item.producto.nombre}</p>
                            <p className="text-[10px] text-frost-500">${precio.toFixed(2)} c/u</p>
                          </div>
                          <button
                            onClick={() => cambiarCantidad(item.producto.id, -1)}
                            className="w-6 h-6 rounded-card bg-frost-100 text-frost-700 text-sm"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs">{item.cantidad}</span>
                          <button
                            onClick={() => cambiarCantidad(item.producto.id, 1)}
                            className="w-6 h-6 rounded-card bg-frost-100 text-frost-700 text-sm"
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-frost-100 pt-3 mb-3 flex justify-between font-semibold text-frost-800 text-sm">
                    <span>Total</span>
                    <span>${totalCarrito.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={confirmarPedido}
                    disabled={enviando}
                    className="btn-primary w-full text-sm"
                  >
                    {enviando ? 'Guardando...' : 'Confirmar pedido'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
