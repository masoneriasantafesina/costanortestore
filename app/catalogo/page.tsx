'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Producto } from '@/lib/types';

type ItemCarrito = {
  producto: Producto;
  cantidad: number;
};

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('todas');
  const [carrito, setCarrito] = useState<Record<string, ItemCarrito>>({});
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [resumenParaWhatsapp, setResumenParaWhatsapp] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '' });

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('exhibir_catalogo', true)
        .order('destacado', { ascending: false })
        .order('nombre', { ascending: true });
      setProductos(data ?? []);
      setCargando(false);
    }
    cargar();
  }, []);

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]);
    return ['todas', ...Array.from(set)];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideCategoria = categoria === 'todas' || p.categoria === categoria;
      const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      return coincideCategoria && coincideBusqueda;
    });
  }, [productos, categoria, busqueda]);

  const destacados = productosFiltrados.filter((p) => p.destacado);
  const resto = productosFiltrados.filter((p) => !p.destacado);

  function agregarAlCarrito(producto: Producto) {
    setEnviado(false);
    setCarrito((prev) => {
      const existente = prev[producto.id];
      return {
        ...prev,
        [producto.id]: {
          producto,
          cantidad: existente ? existente.cantidad + 1 : 1,
        },
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
  const cantidadTotal = itemsCarrito.reduce((acc, item) => acc + item.cantidad, 0);

  async function confirmarPedido(e: React.FormEvent) {
    e.preventDefault();
    if (itemsCarrito.length === 0) return;
    setEnviando(true);

    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_contacto: form.nombre,
        telefono_contacto: form.telefono,
        direccion_contacto: form.direccion,
        items: itemsCarrito.map((item) => ({
          producto_id: item.producto.id,
          nombre_producto: item.producto.nombre,
          precio_unitario: item.producto.precio_promo ?? item.producto.precio_normal,
          cantidad: item.cantidad,
          unidad: item.producto.unidad,
          peso_kg: item.producto.peso_kg ?? 0,
        })),
      }),
    });

    setEnviando(false);
    if (res.ok) {
      const lineas = itemsCarrito.map((item) => {
        const precio = item.producto.precio_promo ?? item.producto.precio_normal;
        return `• ${item.cantidad} x ${item.producto.nombre} ($${(precio * item.cantidad).toFixed(2)})`;
      });
      const mensaje = [
        `Pedido de ${form.nombre}`,
        `Tel: ${form.telefono}`,
        form.direccion ? `Dirección: ${form.direccion}` : null,
        '',
        ...lineas,
        '',
        `Total: $${totalCarrito.toFixed(2)}`,
      ]
        .filter(Boolean)
        .join('\n');
      setResumenParaWhatsapp(mensaje);
      setEnviado(true);
      setCarrito({});
    }
  }

  return (
    <div className="min-h-screen bg-frost-50">
      {/* Encabezado */}
      <header className="bg-frost-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="font-display text-2xl tracking-tight">Grido Store y Mayorista</h1>
          <button
            onClick={() => setCarritoAbierto(true)}
            className="relative bg-mango-500 hover:bg-mango-600 rounded-card px-4 py-2 font-semibold text-sm transition-colors"
          >
            Pedido {cantidadTotal > 0 && `(${cantidadTotal})`}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-frost-700 text-frost-50 border-t border-frost-600">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="font-display text-3xl leading-snug max-w-xl">
            Elegí tus productos y armamos tu pedido en el momento.
          </p>
          <p className="text-frost-200 mt-2 text-sm">
            Sin necesidad de crear una cuenta. Confirmás con tu nombre, teléfono y dirección.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-field sm:max-w-xs"
        />
        <div className="flex gap-2 overflow-x-auto">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`whitespace-nowrap px-3 py-2 rounded-card text-sm font-medium transition-colors ${
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

      {/* Grilla de productos */}
      <main className="max-w-5xl mx-auto px-4 pb-24">
        {cargando && <p className="text-frost-500">Cargando productos...</p>}
        {!cargando && productosFiltrados.length === 0 && (
          <p className="text-frost-500">No encontramos productos con ese filtro.</p>
        )}

        {destacados.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-lg text-frost-800 mb-3">Destacados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {destacados.map((p) => (
                <TarjetaProducto key={p.id} producto={p} onAgregar={agregarAlCarrito} />
              ))}
            </div>
          </section>
        )}

        {resto.length > 0 && (
          <section>
            {destacados.length > 0 && (
              <h2 className="font-display text-lg text-frost-800 mb-3">Todo el catálogo</h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {resto.map((p) => (
                <TarjetaProducto key={p.id} producto={p} onAgregar={agregarAlCarrito} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Panel de carrito */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCarritoAbierto(false)}
          />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl text-frost-800">Tu pedido</h2>
              <button onClick={() => setCarritoAbierto(false)} className="text-frost-500 text-sm">
                Cerrar
              </button>
            </div>

            {enviado ? (
              <div className="text-center py-10">
                <p className="text-lg font-semibold text-frost-800">¡Pedido enviado!</p>
                <p className="text-sm text-frost-500 mt-2">
                  Nos vamos a comunicar para confirmar la entrega.
                </p>
                {resumenParaWhatsapp && process.env.NEXT_PUBLIC_WHATSAPP_NUMERO && (
                  <a
                    href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMERO}?text=${encodeURIComponent(
                      resumenParaWhatsapp
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-card mt-4 text-sm"
                  >
                    Avisar por WhatsApp
                  </a>
                )}
                <button
                  onClick={() => {
                    setEnviado(false);
                    setCarritoAbierto(false);
                  }}
                  className="btn-primary mt-4 block mx-auto"
                >
                  Seguir viendo el catálogo
                </button>
              </div>
            ) : itemsCarrito.length === 0 ? (
              <p className="text-frost-500 text-sm">Todavía no agregaste productos.</p>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {itemsCarrito.map((item) => {
                    const precio = item.producto.precio_promo ?? item.producto.precio_normal;
                    return (
                      <div key={item.producto.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-frost-800">{item.producto.nombre}</p>
                          <p className="text-xs text-frost-500">${precio.toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cambiarCantidad(item.producto.id, -1)}
                            className="w-7 h-7 rounded-card bg-frost-100 text-frost-700"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">{item.cantidad}</span>
                          <button
                            onClick={() => cambiarCantidad(item.producto.id, 1)}
                            className="w-7 h-7 rounded-card bg-frost-100 text-frost-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-frost-100 pt-4 mb-6 flex justify-between font-semibold text-frost-800">
                  <span>Total</span>
                  <span>${totalCarrito.toFixed(2)}</span>
                </div>

                <form onSubmit={confirmarPedido} className="space-y-3">
                  <input
                    required
                    placeholder="Nombre del comercio o persona"
                    className="input-field"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                  <input
                    required
                    placeholder="Teléfono"
                    className="input-field"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                  <input
                    placeholder="Dirección"
                    className="input-field"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  />
                  <button type="submit" disabled={enviando} className="btn-primary w-full">
                    {enviando ? 'Enviando...' : 'Confirmar pedido'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaProducto({
  producto,
  onAgregar,
}: {
  producto: Producto;
  onAgregar: (p: Producto) => void;
}) {
  const tienePromo = producto.precio_promo != null && producto.precio_promo < producto.precio_normal;
  return (
    <div className="bg-white rounded-card border border-frost-100 overflow-hidden flex flex-col">
      <div className="aspect-square bg-frost-50">
        {producto.foto_url ? (
          <img src={producto.foto_url} alt={producto.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-frost-300 text-xs">
            Sin foto
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-medium text-frost-800 leading-snug">{producto.nombre}</p>
        <div className="mt-1 mb-3">
          {tienePromo ? (
            <div className="flex items-baseline gap-2">
              <span className="text-mango-600 font-semibold">${producto.precio_promo!.toFixed(2)}</span>
              <span className="text-frost-400 text-xs line-through">
                ${producto.precio_normal.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-frost-800 font-semibold">${producto.precio_normal.toFixed(2)}</span>
          )}
        </div>
        <button onClick={() => onAgregar(producto)} className="btn-secondary text-sm mt-auto">
          Agregar
        </button>
      </div>
    </div>
  );
}
