'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { MarcaProducto, Producto } from '@/lib/types';
import { MARCA_PRODUCTO_LABEL } from '@/lib/types';
import { formatearPesos } from '@/lib/formato';
import {
  type CatalogoConfig,
  RUTA_CATALOGO,
  configPorDefecto,
  normalizarConfig,
  ordenarCategorias,
  ordenarProductos,
} from '@/lib/catalogo';

const MARCAS: MarcaProducto[] = ['grido', 'via_vana'];

// Achica la imagen del banner (máx. 1600 px de ancho) para que el catálogo cargue rápido.
async function reducirImagen(archivo: File): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const escala = Math.min(1, 1600 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.88)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CatalogoAdminPage() {
  const [marca, setMarca] = useState<MarcaProducto>('grido');
  const [configs, setConfigs] = useState<Record<MarcaProducto, CatalogoConfig>>({
    grido: configPorDefecto('grido'),
    via_vana: configPorDefecto('via_vana'),
  });
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  async function cargar() {
    setCargando(true);
    setErrorCarga('');
    const [resConfig, resProductos] = await Promise.all([
      supabase.from('catalogo_config').select('*'),
      supabase.from('productos').select('*').eq('exhibir_catalogo', true),
    ]);
    if (resConfig.error) {
      setErrorCarga(
        'No se pudo leer la configuración del catálogo. ¿Ya ejecutaste el SQL de la etapa 2 en Supabase? (' +
          resConfig.error.message +
          ')'
      );
    }
    const filas = resConfig.data ?? [];
    setConfigs({
      grido: normalizarConfig('grido', filas.find((f: any) => f.marca === 'grido')),
      via_vana: normalizarConfig('via_vana', filas.find((f: any) => f.marca === 'via_vana')),
    });
    setProductos(resProductos.data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const config = configs[marca];
  const productosMarca = useMemo(() => productos.filter((p) => p.marca === marca), [productos, marca]);

  // Guarda cambios de configuración de la marca actual (crea la fila si no existe).
  async function guardarConfig(cambios: Partial<CatalogoConfig>): Promise<boolean> {
    const nueva = { ...config, ...cambios };
    const { error } = await supabase.from('catalogo_config').upsert(
      {
        marca,
        abierto: nueva.abierto,
        mensaje_cerrado: nueva.mensaje_cerrado,
        monto_minimo: nueva.monto_minimo,
        banner_url: nueva.banner_url,
        orden_categorias: nueva.orden_categorias,
        categorias_por_precio: nueva.categorias_por_precio,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'marca' }
    );
    if (error) {
      alert('No se pudo guardar: ' + error.message);
      return false;
    }
    setConfigs((prev) => ({ ...prev, [marca]: nueva }));
    return true;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl text-frost-800 mb-1">Catálogo</h1>
      <p className="text-sm text-frost-500 mb-5">
        Cada catálogo (Grido y Via Vana) se configura por separado.
      </p>

      <div className="flex gap-2 mb-5">
        {MARCAS.map((m) => (
          <button
            key={m}
            onClick={() => setMarca(m)}
            className={`px-4 py-2 rounded-card text-sm font-semibold ${
              marca === m ? 'bg-frost-700 text-white' : 'bg-white text-frost-700 border border-frost-200'
            }`}
          >
            {MARCA_PRODUCTO_LABEL[m]}
            {!configs[m].abierto && <span className="ml-2 text-[10px] bg-red-500 text-white rounded px-1.5 py-0.5">CERRADO</span>}
          </button>
        ))}
      </div>

      {errorCarga && (
        <div className="mb-4 rounded-card bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{errorCarga}</div>
      )}
      {cargando ? (
        <p className="text-frost-500 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-5">
          <EstadoYCompartir key={marca + '-estado'} marca={marca} config={config} onGuardar={guardarConfig} />
          <Banner key={marca + '-banner'} marca={marca} config={config} onGuardar={guardarConfig} />
          <OrdenCategorias
            key={marca + '-cats'}
            productos={productosMarca}
            config={config}
            onGuardar={guardarConfig}
          />
          <OrdenProductos
            key={marca + '-prods'}
            productos={productosMarca}
            config={config}
            onCambio={(actualizados) =>
              setProductos((prev) => prev.map((p) => actualizados.find((a) => a.id === p.id) ?? p))
            }
          />
        </div>
      )}
    </div>
  );
}

function Tarjeta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-card border border-frost-100 p-4 sm:p-5">
      <h2 className="font-display text-lg text-frost-800">{titulo}</h2>
      {ayuda && <p className="text-xs text-frost-500 mt-0.5 mb-3">{ayuda}</p>}
      {!ayuda && <div className="mb-3" />}
      {children}
    </section>
  );
}

function EstadoYCompartir({
  marca,
  config,
  onGuardar,
}: {
  marca: MarcaProducto;
  config: CatalogoConfig;
  onGuardar: (c: Partial<CatalogoConfig>) => Promise<boolean>;
}) {
  const [mensaje, setMensaje] = useState(config.mensaje_cerrado);
  const [minimo, setMinimo] = useState(config.monto_minimo ? String(config.monto_minimo) : '');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.origin + RUTA_CATALOGO[marca] : RUTA_CATALOGO[marca];

  async function alternar() {
    if (config.abierto && !window.confirm(`¿Cerrar el catálogo de ${MARCA_PRODUCTO_LABEL[marca]}? La gente no va a poder hacer pedidos.`)) {
      return;
    }
    await onGuardar({ abierto: !config.abierto });
  }

  async function guardarAjustes() {
    const monto = minimo.trim() === '' ? 0 : Number(minimo.replace(',', '.'));
    if (!Number.isFinite(monto) || monto < 0) {
      alert('El monto mínimo tiene que ser un número (por ejemplo 20000).');
      return;
    }
    if (!mensaje.trim()) {
      alert('Escribí el mensaje que verá la gente cuando el catálogo esté cerrado.');
      return;
    }
    setGuardando(true);
    const ok = await onGuardar({ mensaje_cerrado: mensaje.trim(), monto_minimo: monto });
    setGuardando(false);
    if (ok) {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copiá este link:', url);
    }
  }

  async function compartir() {
    const texto = `Catálogo ${MARCA_PRODUCTO_LABEL[marca]} · Tild@ Costa Norte Mayorista`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: texto, text: texto, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    await copiar();
  }

  return (
    <Tarjeta titulo="Estado y ajustes">
      <button
        onClick={alternar}
        className={`w-full rounded-card px-4 py-4 text-left flex items-center justify-between font-semibold ${
          config.abierto ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'
        }`}
      >
        <span>
          {config.abierto ? 'Catálogo ABIERTO' : 'Catálogo CERRADO'}
          <span className="block text-xs font-normal mt-0.5">
            {config.abierto ? 'La gente puede hacer pedidos. Tocá para cerrarlo.' : 'La gente no puede pedir. Tocá para abrirlo.'}
          </span>
        </span>
        <span
          className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${config.abierto ? 'bg-green-500' : 'bg-red-400'}`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${config.abierto ? 'left-[22px]' : 'left-0.5'}`}
          />
        </span>
      </button>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Mensaje cuando está cerrado</label>
          <textarea
            rows={2}
            className="input-field mt-1"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Monto mínimo de pedido ($)</label>
          <input
            inputMode="decimal"
            placeholder="0 = sin mínimo"
            className="input-field mt-1 sm:max-w-xs"
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
          />
          <p className="text-xs text-frost-400 mt-1">
            Aplica solo a pedidos del catálogo público. Venta Directa no tiene mínimo.
            {Number(minimo) > 0 && <> Mínimo actual: {formatearPesos(Number(minimo.replace(',', '.')))}.</>}
          </p>
        </div>
        <button onClick={guardarAjustes} disabled={guardando} className="btn-primary text-sm">
          {guardando ? 'Guardando...' : guardado ? '¡Guardado!' : 'Guardar mensaje y mínimo'}
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-frost-100">
        <label className="text-xs font-semibold text-frost-500 uppercase">Link del catálogo</label>
        <p className="text-sm text-frost-700 break-all mt-1 mb-3">{url}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={compartir} className="btn-primary text-sm">
            Compartir catálogo
          </button>
          <button onClick={copiar} className="btn-secondary text-sm">
            {copiado ? '¡Link copiado!' : 'Copiar link'}
          </button>
          <a href={RUTA_CATALOGO[marca]} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            Ver catálogo
          </a>
        </div>
      </div>
    </Tarjeta>
  );
}

function Banner({
  marca,
  config,
  onGuardar,
}: {
  marca: MarcaProducto;
  config: CatalogoConfig;
  onGuardar: (c: Partial<CatalogoConfig>) => Promise<boolean>;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      setError('El archivo tiene que ser una imagen.');
      return;
    }
    setSubiendo(true);
    setError('');
    try {
      const blob = await reducirImagen(archivo);
      const ruta = `banners/${marca}-${Date.now()}.jpg`;
      const { error: errorSubida } = await supabase.storage
        .from('fotos')
        .upload(ruta, blob, { upsert: true, contentType: 'image/jpeg' });
      if (errorSubida) throw new Error(errorSubida.message);
      const { data } = supabase.storage.from('fotos').getPublicUrl(ruta);
      await onGuardar({ banner_url: data.publicUrl });
    } catch (err) {
      setError('No se pudo subir el banner: ' + (err as Error).message);
    }
    setSubiendo(false);
  }

  async function quitar() {
    if (!window.confirm('¿Quitar el banner? El catálogo vuelve a mostrarse sin banner.')) return;
    await onGuardar({ banner_url: null });
  }

  return (
    <Tarjeta
      titulo="Banner"
      ayuda="Aparece arriba de las categorías, solo si cargás una imagen. Ideal: horizontal, 1500×500 px."
    >
      {config.banner_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.banner_url} alt="Banner" className="w-full h-auto rounded-card border border-frost-100 mb-3" />
      ) : (
        <p className="text-sm text-frost-400 mb-3">Sin banner cargado: el catálogo se muestra sin banner.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="btn-secondary text-sm cursor-pointer">
          {subiendo ? 'Subiendo...' : config.banner_url ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/*" className="hidden" onChange={subir} disabled={subiendo} />
        </label>
        {config.banner_url && (
          <button onClick={quitar} className="text-sm font-medium text-red-600 border border-red-200 rounded-card px-3 py-2 hover:bg-red-50">
            Quitar banner
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </Tarjeta>
  );
}

function Flechas({
  puedeSubir,
  puedeBajar,
  onSubir,
  onBajar,
}: {
  puedeSubir: boolean;
  puedeBajar: boolean;
  onSubir: () => void;
  onBajar: () => void;
}) {
  const cls =
    'w-9 h-9 rounded-card border border-frost-200 text-frost-700 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-frost-50';
  return (
    <div className="flex gap-1 shrink-0">
      <button onClick={onSubir} disabled={!puedeSubir} className={cls} aria-label="Subir">
        ▲
      </button>
      <button onClick={onBajar} disabled={!puedeBajar} className={cls} aria-label="Bajar">
        ▼
      </button>
    </div>
  );
}

function OrdenCategorias({
  productos,
  config,
  onGuardar,
}: {
  productos: Producto[];
  config: CatalogoConfig;
  onGuardar: (c: Partial<CatalogoConfig>) => Promise<boolean>;
}) {
  const [guardando, setGuardando] = useState(false);
  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]);
    return ordenarCategorias(Array.from(set), config);
  }, [productos, config]);

  async function mover(i: number, delta: number) {
    const lista = [...categorias];
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setGuardando(true);
    await onGuardar({ orden_categorias: lista });
    setGuardando(false);
  }

  async function alternarPrecio(cat: string) {
    const actual = config.categorias_por_precio;
    const nueva = actual.includes(cat) ? actual.filter((c) => c !== cat) : [...actual, cat];
    // Al guardar, también fijamos el orden de categorías tal como se ve ahora.
    setGuardando(true);
    await onGuardar({ categorias_por_precio: nueva, orden_categorias: categorias });
    setGuardando(false);
  }

  return (
    <Tarjeta titulo="Orden de las categorías" ayuda="Es el orden en que aparecen los botones y los productos en el catálogo.">
      {categorias.length === 0 && <p className="text-sm text-frost-400">No hay productos en el catálogo de esta marca.</p>}
      <ul className="divide-y divide-frost-100">
        {categorias.map((cat, i) => (
          <li key={cat} className="py-2.5 flex items-center gap-3">
            <span className="w-6 text-center text-xs text-frost-400">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-frost-800">{cat}</p>
              <label className="flex items-center gap-1.5 text-xs text-frost-500 mt-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.categorias_por_precio.includes(cat)}
                  onChange={() => alternarPrecio(cat)}
                  disabled={guardando}
                />
                Ordenar por precio (de más caro a más barato)
              </label>
            </div>
            <Flechas
              puedeSubir={i > 0 && !guardando}
              puedeBajar={i < categorias.length - 1 && !guardando}
              onSubir={() => mover(i, -1)}
              onBajar={() => mover(i, 1)}
            />
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function OrdenProductos({
  productos,
  config,
  onCambio,
}: {
  productos: Producto[];
  config: CatalogoConfig;
  onCambio: (actualizados: Producto[]) => void;
}) {
  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]);
    return ordenarCategorias(Array.from(set), config);
  }, [productos, config]);
  const [categoria, setCategoria] = useState<string>(categorias[0] ?? '');
  const [trabajando, setTrabajando] = useState(false);

  const catActual = categorias.includes(categoria) ? categoria : categorias[0] ?? '';
  const lista = useMemo(
    () => ordenarProductos(productos.filter((p) => p.categoria === catActual), config),
    [productos, catActual, config]
  );
  const porPrecio = config.categorias_por_precio.includes(catActual);

  async function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const nuevo = [...lista];
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    setTrabajando(true);
    // Se renumera toda la categoría (1, 2, 3...) para que el orden quede explícito.
    const resultados = await Promise.all(
      nuevo.map((p, idx) =>
        p.orden_catalogo === idx + 1
          ? Promise.resolve({ error: null })
          : supabase.from('productos').update({ orden_catalogo: idx + 1 }).eq('id', p.id)
      )
    );
    setTrabajando(false);
    const fallo = resultados.find((r) => r.error);
    if (fallo?.error) {
      alert('No se pudo guardar el orden: ' + fallo.error.message);
      return;
    }
    onCambio(nuevo.map((p, idx) => ({ ...p, orden_catalogo: idx + 1 })));
  }

  async function alternarAgotado(p: Producto) {
    setTrabajando(true);
    const { error } = await supabase.from('productos').update({ agotado: !p.agotado }).eq('id', p.id);
    setTrabajando(false);
    if (error) {
      alert('No se pudo guardar: ' + error.message);
      return;
    }
    onCambio([{ ...p, agotado: !p.agotado }]);
  }

  return (
    <Tarjeta
      titulo="Productos por categoría"
      ayuda="Acomodá los productos dentro de cada categoría y marcá los que están sin stock (se ven en el catálogo pero no se pueden agregar). Solo aparecen los productos que se exhiben en el catálogo."
    >
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`whitespace-nowrap px-3 py-2 rounded-card text-sm font-medium ${
              catActual === c ? 'bg-frost-700 text-white' : 'bg-white text-frost-700 border border-frost-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {porPrecio && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-card px-3 py-2 mb-3">
          Esta categoría está ordenada por precio (de más caro a más barato), así que no se puede mover a mano. Para
          acomodarla manualmente, desmarcá esa opción en “Orden de las categorías”.
        </p>
      )}

      <ul className="divide-y divide-frost-100">
        {lista.map((p, i) => (
          <li key={p.id} className="py-2.5 flex items-center gap-3">
            <span className="w-6 text-center text-xs text-frost-400">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${p.agotado ? 'text-frost-400 line-through' : 'text-frost-800'}`}>{p.nombre}</p>
              <p className="text-xs text-frost-500">{formatearPesos(p.precio_promo ?? p.precio_normal)}</p>
            </div>
            <button
              onClick={() => alternarAgotado(p)}
              disabled={trabajando}
              className={`shrink-0 text-xs font-semibold rounded-card px-2.5 py-2 border ${
                p.agotado
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-frost-200 text-frost-600 hover:bg-frost-50'
              }`}
            >
              {p.agotado ? 'Sin stock' : 'Hay stock'}
            </button>
            {!porPrecio && (
              <Flechas
                puedeSubir={i > 0 && !trabajando}
                puedeBajar={i < lista.length - 1 && !trabajando}
                onSubir={() => mover(i, -1)}
                onBajar={() => mover(i, 1)}
              />
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
