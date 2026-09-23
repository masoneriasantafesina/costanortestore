'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Producto } from '@/lib/types';
import { MARCA_PRODUCTO_LABEL } from '@/lib/types';
import { registrarLog } from '@/lib/log';

type Fila = {
  id: string;
  precio_normal: number;
  precio_promo: number | null;
  unidad: string;
  peso_kg: number | null;
  stock: number | null;
};

function filaDeProducto(p: Producto): Fila {
  return {
    id: p.id,
    precio_normal: p.precio_normal,
    precio_promo: p.precio_promo,
    unidad: p.unidad,
    peso_kg: p.peso_kg,
    stock: p.stock,
  };
}

export default function PreciosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [original, setOriginal] = useState<Record<string, Fila>>({});
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [filtroMarca, setFiltroMarca] = useState<Producto['marca'] | 'todas'>('todas');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('productos').select('*').order('nombre');
    const lista = data ?? [];
    setProductos(lista);
    const base: Record<string, Fila> = {};
    lista.forEach((p) => {
      base[p.id] = filaDeProducto(p);
    });
    setOriginal(base);
    setFilas(base);
    setGuardando(false);
    setGuardado(false);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]);
    return ['todas', ...Array.from(set)];
  }, [productos]);

  const productosFiltrados = productos.filter((p) => {
    const coincideMarca = filtroMarca === 'todas' || p.marca === filtroMarca;
    const coincideCategoria = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideMarca && coincideCategoria && coincideBusqueda;
  });

  function actualizarFila(id: string, cambios: Partial<Fila>) {
    setGuardado(false);
    setFilas((prev) => ({ ...prev, [id]: { ...prev[id], ...cambios } }));
  }

  function filaCambiada(id: string): boolean {
    const a = original[id];
    const b = filas[id];
    if (!a || !b) return false;
    return (
      a.precio_normal !== b.precio_normal ||
      a.precio_promo !== b.precio_promo ||
      a.unidad !== b.unidad ||
      a.peso_kg !== b.peso_kg ||
      a.stock !== b.stock
    );
  }

  const cantidadCambiadas = productos.filter((p) => filaCambiada(p.id)).length;

  async function guardarTodo() {
    const cambiadas = productos.filter((p) => filaCambiada(p.id));
    if (cambiadas.length === 0) return;
    setGuardando(true);

    await Promise.all(
      cambiadas.map((p) => {
        const f = filas[p.id];
        return supabase
          .from('productos')
          .update({
            precio_normal: f.precio_normal,
            precio_promo: f.precio_promo,
            unidad: f.unidad,
            peso_kg: f.peso_kg,
            stock: f.stock,
          })
          .eq('id', p.id);
      })
    );

    await Promise.all(
      cambiadas.map((p) => {
        const o = original[p.id];
        const f = filas[p.id];
        return registrarLog(
          'editar_precio',
          'producto',
          p.id,
          `Producto "${p.nombre}" (edición masiva): precio $${o.precio_normal} → $${f.precio_normal}` +
            (o.peso_kg !== f.peso_kg ? `, peso ${o.peso_kg ?? 0}kg → ${f.peso_kg ?? 0}kg` : '')
        );
      })
    );

    await cargar();
    setGuardado(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl text-frost-800">Edición masiva de precios</h1>
          <Link href="/admin/productos" className="text-xs text-frost-500 underline">
            ← Volver a productos
          </Link>
        </div>
        <button
          onClick={guardarTodo}
          disabled={guardando || cantidadCambiadas === 0}
          className="btn-primary disabled:opacity-40"
        >
          {guardando ? 'Guardando...' : `Guardar cambios${cantidadCambiadas > 0 ? ` (${cantidadCambiadas})` : ''}`}
        </button>
      </div>

      {guardado && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-card px-4 py-2 mb-4">
          Cambios guardados.
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {(['todas', 'grido', 'via_vana'] as const).map((valor) => (
          <button
            key={valor}
            onClick={() => setFiltroMarca(valor)}
            className={`px-3 py-2 rounded-card text-sm font-medium ${
              filtroMarca === valor
                ? 'bg-frost-700 text-white'
                : 'bg-white text-frost-700 border border-frost-200'
            }`}
          >
            {valor === 'todas' ? 'Todas' : MARCA_PRODUCTO_LABEL[valor]}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          placeholder="Buscar producto..."
          className="input-field sm:max-w-xs"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`whitespace-nowrap px-3 py-2 rounded-card text-sm font-medium ${
                filtroCategoria === cat
                  ? 'bg-frost-700 text-white'
                  : 'bg-white text-frost-700 border border-frost-200'
              }`}
            >
              {cat === 'todas' ? 'Todas las categorías' : cat}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-card border border-frost-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-frost-100 text-left text-xs text-frost-500 uppercase">
                <th className="px-3 py-2 font-semibold">Producto</th>
                <th className="px-3 py-2 font-semibold">Marca</th>
                <th className="px-3 py-2 font-semibold w-28">Precio normal</th>
                <th className="px-3 py-2 font-semibold w-28">Precio promo</th>
                <th className="px-3 py-2 font-semibold w-24">Unidad</th>
                <th className="px-3 py-2 font-semibold w-24">Peso (kg)</th>
                <th className="px-3 py-2 font-semibold w-24">Stock</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => {
                const f = filas[p.id];
                if (!f) return null;
                const cambiada = filaCambiada(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-frost-50 ${cambiada ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-frost-800">{p.nombre}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-card ${
                          p.marca === 'via_vana' ? 'bg-purple-100 text-purple-700' : 'bg-frost-100 text-frost-600'
                        }`}
                      >
                        {MARCA_PRODUCTO_LABEL[p.marca]}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        className="input-field text-sm py-1"
                        value={f.precio_normal}
                        onChange={(e) =>
                          actualizarFila(p.id, { precio_normal: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="—"
                        className="input-field text-sm py-1"
                        value={f.precio_promo ?? ''}
                        onChange={(e) =>
                          actualizarFila(p.id, {
                            precio_promo: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="input-field text-sm py-1"
                        value={f.unidad}
                        onChange={(e) => actualizarFila(p.id, { unidad: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="—"
                        className="input-field text-sm py-1"
                        value={f.peso_kg ?? ''}
                        onChange={(e) =>
                          actualizarFila(p.id, {
                            peso_kg: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        placeholder="—"
                        className="input-field text-sm py-1"
                        value={f.stock ?? ''}
                        onChange={(e) =>
                          actualizarFila(p.id, {
                            stock: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              {productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-frost-400">
                    Sin resultados con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-frost-400 mt-3">
        Las filas resaltadas en amarillo tienen cambios sin guardar. Cambiar el filtro o la búsqueda no
        descarta lo que ya editaste.
      </p>
    </div>
  );
}
