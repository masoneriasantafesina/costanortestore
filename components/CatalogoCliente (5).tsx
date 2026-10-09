'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { MarcaProducto, Producto } from '@/lib/types';
import { formatearPesos } from '@/lib/formato';

type ItemCarrito = {
  producto: Producto;
  cantidad: number;
};

const ICONO = {
  carrito:
    'M6 6h15l-1.5 9h-12L6 6Zm0 0-1-3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  tacho:
    'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14M10 11v6M14 11v6',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  cerrar: 'M6 6l12 12M18 6 6 18',
};

function Icono({ path, className = 'w-5 h-5' }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

export default function CatalogoCliente({
  marca,
  nombreNegocio,
}: {
  marca: MarcaProducto;
  nombreNegocio: string;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('todas');
  const [carrito, setCarrito] = useState<Record<string, ItemCarrito>>({});
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [resumenParaWhatsapp, setResumenParaWhatsapp] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '' });

  // Puntos de destino de la animación de "volar al carrito".
  const iconoBarraRef = useRef<HTMLSpanElement>(null);
  const iconoHeaderRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('exhibir_catalogo', true)
        .eq('marca', marca)
        .order('destacado', { ascending: false })
        .order('nombre', { ascending: true });
      setProductos(data ?? []);
      setCargando(false);
    }
    cargar();
  }, [marca]);

  // Cerrar el detalle del producto con la tecla Escape.
  useEffect(() => {
    if (!detalle) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDetalle(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detalle]);

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

  // Hace "volar" una copia de la foto del producto desde donde se tocó hasta el carrito.
  function volarAlCarrito(origen: HTMLElement | null, fotoUrl: string | null) {
    if (typeof window === 'undefined' || !origen || typeof origen.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const desde = origen.getBoundingClientRect();
    const destinoEl = iconoBarraRef.current ?? iconoHeaderRef.current;
    let destinoX = window.innerWidth / 2;
    let destinoY = window.innerHeight - 40;
    if (destinoEl) {
      const r = destinoEl.getBoundingClientRect();
      destinoX = r.left + r.width / 2;
      destinoY = r.top + r.height / 2;
    }

    const tam = 56;
    const volador = document.createElement('div');
    volador.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      `width:${tam}px`,
      `height:${tam}px`,
      'border-radius:9999px',
      'z-index:9999',
      'pointer-events:none',
      'background-color:#ffffff',
      'background-position:center',
      'background-size:cover',
      'border:3px solid #fdaa01',
      'box-shadow:0 8px 20px rgba(0,0,0,0.3)',
    ].join(';');
    if (fotoUrl) volador.style.backgroundImage = `url(${JSON.stringify(fotoUrl)})`;
    document.body.appendChild(volador);

    const x0 = desde.left + desde.width / 2 - tam / 2;
    const y0 = desde.top + desde.height / 2 - tam / 2;
    const x1 = destinoX - tam / 2;
    const y1 = destinoY - tam / 2;
    const alturaArco = Math.min(y0, y1) - 70;

    const animacion = volador.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
        { transform: `translate(${(x0 + x1) / 2}px, ${alturaArco}px) scale(0.85)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.2)`, opacity: 0.5 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.4, 0.1, 0.3, 1)' }
    );
    const terminar = () => {
      volador.remove();
      // Un "latido" en el ícono del carrito al llegar.
      const icono = iconoBarraRef.current ?? iconoHeaderRef.current;
      icono?.animate?.(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
        { duration: 300 }
      );
    };
    animacion.onfinish = terminar;
    animacion.oncancel = () => volador.remove();
  }

  function agregarAlCarrito(producto: Producto, origen?: HTMLElement | null) {
    setEnviado(false);
    volarAlCarrito(origen ?? null, producto.foto_url);
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

    // Los navegadores (sobre todo en celular) bloquean abrir una pestaña nueva
    // si no se hace en el momento exacto del clic. Por eso la abrimos ahora,
    // vacía, y recién después de guardar el pedido le cargamos WhatsApp.
    const numeroWhatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO;
    const ventanaWhatsapp = numeroWhatsapp ? window.open('', '_blank') : null;

    let res: Response;
    try {
      res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_contacto: form.nombre,
          telefono_contacto: form.telefono,
          direccion_contacto: form.direccion,
          marca,
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
    } catch {
      ventanaWhatsapp?.close();
      setEnviando(false);
      alert('No se pudo enviar el pedido. Revisá tu conexión e intentá de nuevo.');
      return;
    }

    setEnviando(false);
    if (!res.ok) {
      ventanaWhatsapp?.close();
      alert('No se pudo enviar el pedido. Intentá de nuevo en unos minutos.');
      return;
    }

    const lineas = itemsCarrito.map((item) => {
      const precio = item.producto.precio_promo ?? item.producto.precio_normal;
      return `• ${item.cantidad} x ${item.producto.nombre} (${formatearPesos(precio * item.cantidad)})`;
    });
    const mensaje = [
      `Pedido de ${form.nombre}`,
      `Tel: ${form.telefono}`,
      form.direccion ? `Dirección: ${form.direccion}` : null,
      '',
      ...lineas,
      '',
      `Total: ${formatearPesos(totalCarrito)}`,
    ]
      .filter(Boolean)
      .join('\n');
    setResumenParaWhatsapp(mensaje);
    setEnviado(true);
    setCarrito({});

    if (numeroWhatsapp) {
      const urlWhatsapp = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(mensaje)}`;
      if (ventanaWhatsapp) {
        ventanaWhatsapp.location.href = urlWhatsapp;
      } else {
        // El navegador no nos dejó abrir la pestaña: navegamos en la misma.
        window.location.href = urlWhatsapp;
      }
    }
  }

  return (
    <div className="min-h-screen bg-frost-50">
      {/* Encabezado */}
      <header className="bg-frost-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/tilda-wordmark-v2.png" alt="Tild@" className="h-9 w-auto block mb-1" />
            <h1 className="font-display text-2xl tracking-tight">{nombreNegocio}</h1>
          </div>
          <button
            ref={iconoHeaderRef}
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
      <main className="max-w-5xl mx-auto px-4 pb-32">
        {cargando && <p className="text-frost-500">Cargando productos...</p>}
        {!cargando && productosFiltrados.length === 0 && (
          <p className="text-frost-500">No encontramos productos con ese filtro.</p>
        )}

        {destacados.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-lg text-frost-800 mb-3">Destacados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {destacados.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  cantidad={carrito[p.id]?.cantidad ?? 0}
                  onAgregar={agregarAlCarrito}
                  onCambiar={cambiarCantidad}
                  onVerDetalle={setDetalle}
                />
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
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  cantidad={carrito[p.id]?.cantidad ?? 0}
                  onAgregar={agregarAlCarrito}
                  onCambiar={cambiarCantidad}
                  onVerDetalle={setDetalle}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Barra fija inferior: total y acceso al carrito mientras se arma el pedido */}
      {cantidadTotal > 0 && !carritoAbierto && !detalle && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-frost-100 shadow-[0_-4px_16px_rgba(9,40,104,0.12)] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
            <div className="shrink-0">
              <p className="text-lg font-bold text-frost-800 leading-tight">{formatearPesos(totalCarrito)}</p>
              <p className="text-sm text-frost-500 leading-tight">
                {cantidadTotal} {cantidadTotal === 1 ? 'artículo' : 'artículos'}
              </p>
            </div>
            <button
              onClick={() => setCarritoAbierto(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-frost-800 hover:bg-frost-700 text-white font-semibold rounded-card py-3.5 transition-colors"
            >
              <span ref={iconoBarraRef} className="inline-flex">
                <Icono path={ICONO.carrito} className="w-5 h-5" />
              </span>
              Ver carrito
            </button>
          </div>
        </div>
      )}

      {/* Detalle del producto */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetalle(null)} />
          <div className="relative bg-white w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-card shadow-xl">
            <button
              onClick={() => setDetalle(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 text-frost-700 shadow flex items-center justify-center"
              aria-label="Cerrar"
            >
              <Icono path={ICONO.cerrar} className="w-5 h-5" />
            </button>
            <div className="aspect-square bg-frost-50">
              {detalle.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detalle.foto_url} alt={detalle.nombre} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-frost-300 text-sm">
                  Sin foto
                </div>
              )}
            </div>
            <div className="p-5">
              {detalle.categoria && (
                <span className="inline-block text-xs font-semibold text-frost-600 bg-frost-100 rounded-card px-2 py-0.5 mb-2">
                  {detalle.categoria}
                </span>
              )}
              <h3 className="font-display text-2xl text-frost-800 leading-snug">{detalle.nombre}</h3>

              <div className="mt-2 flex items-baseline gap-2">
                {detalle.precio_promo != null && detalle.precio_promo < detalle.precio_normal ? (
                  <>
                    <span className="text-2xl font-bold text-mango-600">{formatearPesos(detalle.precio_promo)}</span>
                    <span className="text-sm text-frost-400 line-through">{formatearPesos(detalle.precio_normal)}</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-frost-800">{formatearPesos(detalle.precio_normal)}</span>
                )}
              </div>

              {detalle.descripcion && (
                <p className="text-sm text-frost-600 mt-3 whitespace-pre-line">{detalle.descripcion}</p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {detalle.peso_kg != null && detalle.peso_kg > 0 && (
                  <div className="bg-frost-50 rounded-card px-3 py-2">
                    <dt className="text-xs text-frost-400">Peso</dt>
                    <dd className="font-semibold text-frost-800">
                      {String(detalle.peso_kg).replace('.', ',')} kg
                    </dd>
                  </div>
                )}
                {detalle.unidad && (
                  <div className="bg-frost-50 rounded-card px-3 py-2">
                    <dt className="text-xs text-frost-400">Se vende por</dt>
                    <dd className="font-semibold text-frost-800">{detalle.unidad}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-5">
                {(carrito[detalle.id]?.cantidad ?? 0) === 0 ? (
                  <button
                    onClick={(e) => agregarAlCarrito(detalle, e.currentTarget)}
                    className="btn-primary w-full"
                  >
                    Agregar al pedido
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <ControlCantidad
                      cantidad={carrito[detalle.id].cantidad}
                      grande
                      onMenos={() => cambiarCantidad(detalle.id, -1)}
                      onMas={(el) => agregarAlCarrito(detalle, el)}
                    />
                    <button
                      onClick={() => {
                        setDetalle(null);
                        setCarritoAbierto(true);
                      }}
                      className="flex-1 bg-frost-800 hover:bg-frost-700 text-white font-semibold rounded-card py-3 transition-colors"
                    >
                      Ver carrito
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                    ¿No se abrió WhatsApp? Tocá acá
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-frost-800">{item.producto.nombre}</p>
                          <p className="text-xs text-frost-500">{formatearPesos(precio)} c/u</p>
                        </div>
                        <ControlCantidad
                          cantidad={item.cantidad}
                          onMenos={() => cambiarCantidad(item.producto.id, -1)}
                          onMas={() => cambiarCantidad(item.producto.id, 1)}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-frost-100 pt-4 mb-6 flex justify-between font-semibold text-frost-800">
                  <span>Total</span>
                  <span>{formatearPesos(totalCarrito)}</span>
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

// Control de cantidad: tachito (cuando hay 1 unidad, para anular), cantidad y "+".
function ControlCantidad({
  cantidad,
  onMenos,
  onMas,
  grande,
}: {
  cantidad: number;
  onMenos: () => void;
  onMas: (el: HTMLElement) => void;
  grande?: boolean;
}) {
  const boton = grande ? 'w-11 h-11' : 'w-9 h-9';
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMenos}
        aria-label={cantidad === 1 ? 'Quitar del pedido' : 'Restar una unidad'}
        className={`${boton} rounded-card flex items-center justify-center transition-colors ${
          cantidad === 1
            ? 'text-red-600 bg-red-50 hover:bg-red-100'
            : 'text-frost-700 bg-frost-100 hover:bg-frost-200'
        }`}
      >
        <Icono path={cantidad === 1 ? ICONO.tacho : ICONO.menos} className="w-5 h-5" />
      </button>
      <span className={`${grande ? 'w-8 text-lg' : 'w-7 text-base'} text-center font-bold text-frost-800`}>
        {cantidad}
      </span>
      <button
        onClick={(e) => onMas(e.currentTarget)}
        aria-label="Sumar una unidad"
        className={`${boton} rounded-card flex items-center justify-center text-white bg-frost-800 hover:bg-frost-700 transition-colors`}
      >
        <Icono path={ICONO.mas} className="w-5 h-5" />
      </button>
    </div>
  );
}

function TarjetaProducto({
  producto,
  cantidad,
  onAgregar,
  onCambiar,
  onVerDetalle,
}: {
  producto: Producto;
  cantidad: number;
  onAgregar: (p: Producto, origen?: HTMLElement | null) => void;
  onCambiar: (id: string, delta: number) => void;
  onVerDetalle: (p: Producto) => void;
}) {
  const tienePromo = producto.precio_promo != null && producto.precio_promo < producto.precio_normal;
  return (
    <div className="bg-white rounded-card border border-frost-100 overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => onVerDetalle(producto)}
        aria-label={`Ver detalle de ${producto.nombre}`}
        className="block w-full aspect-square bg-frost-50 cursor-pointer"
      >
        {producto.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.foto_url}
            alt={producto.nombre}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-frost-300 text-xs">
            Sin foto
          </div>
        )}
      </button>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-medium text-frost-800 leading-snug">{producto.nombre}</p>
        <div className="mt-1 mb-3">
          {tienePromo ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-mango-600 font-semibold">{formatearPesos(producto.precio_promo!)}</span>
              <span className="text-frost-400 text-xs line-through">
                {formatearPesos(producto.precio_normal)}
              </span>
            </div>
          ) : (
            <span className="text-frost-800 font-semibold">{formatearPesos(producto.precio_normal)}</span>
          )}
        </div>
        <div className="mt-auto">
          {cantidad === 0 ? (
            <button onClick={(e) => onAgregar(producto, e.currentTarget)} className="btn-secondary text-sm w-full">
              Agregar
            </button>
          ) : (
            <div className="flex justify-end">
              <ControlCantidad
                cantidad={cantidad}
                onMenos={() => onCambiar(producto.id, -1)}
                onMas={(el) => onAgregar(producto, el)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
