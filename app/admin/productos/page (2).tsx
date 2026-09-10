'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Producto } from '@/lib/types';
import SubidaFoto from '@/components/SubidaFoto';

const VACIO: Omit<Producto, 'id'> = {
  nombre: '',
  categoria: '',
  descripcion: '',
  foto_url: '',
  precio_normal: 0,
  precio_promo: null,
  unidad: 'unidad',
  stock: null,
  exhibir_catalogo: true,
  destacado: false,
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('productos').select('*').order('nombre');
    setProductos(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Productos</h1>
        <button
          onClick={() => {
            setEditando(null);
            setFormAbierto(true);
          }}
          className="btn-primary"
        >
          + Nuevo producto
        </button>
      </div>

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {productos.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setEditando(p);
                setFormAbierto(true);
              }}
              className="text-left bg-white rounded-card border border-frost-100 overflow-hidden"
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
              <div className="p-3">
                <p className="text-sm font-medium text-frost-800">{p.nombre}</p>
                <p className="text-xs text-frost-500">${p.precio_normal.toFixed(2)}</p>
                <div className="flex gap-1 mt-2">
                  {p.destacado && (
                    <span className="text-[10px] bg-mango-100 text-mango-600 px-2 py-0.5 rounded-card">
                      Destacado
                    </span>
                  )}
                  {!p.exhibir_catalogo && (
                    <span className="text-[10px] bg-frost-100 text-frost-500 px-2 py-0.5 rounded-card">
                      Oculto
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {formAbierto && (
        <FormularioProducto
          producto={editando}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={() => {
            setFormAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function FormularioProducto({
  producto,
  onCerrar,
  onGuardado,
}: {
  producto: Producto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState(producto ?? VACIO);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    if (producto) {
      await supabase.from('productos').update(form).eq('id', producto.id);
    } else {
      await supabase.from('productos').insert(form);
    }
    setGuardando(false);
    onGuardado();
  }

  async function eliminar() {
    if (!producto) return;
    if (!confirm('¿Eliminar este producto?')) return;
    await supabase.from('productos').delete().eq('id', producto.id);
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <form
        onSubmit={guardar}
        className="relative bg-white rounded-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-3"
      >
        <h2 className="font-display text-xl text-frost-800 mb-2">
          {producto ? 'Editar producto' : 'Nuevo producto'}
        </h2>

        <input
          required
          placeholder="Nombre"
          className="input-field"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <input
          placeholder="Categoría"
          className="input-field"
          value={form.categoria ?? ''}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
        />
        <textarea
          placeholder="Descripción"
          className="input-field"
          rows={2}
          value={form.descripcion ?? ''}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-frost-500 uppercase">Precio normal</label>
            <input
              required
              type="number"
              step="0.01"
              className="input-field mt-1"
              value={form.precio_normal}
              onChange={(e) => setForm({ ...form, precio_normal: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-frost-500 uppercase">Precio promo</label>
            <input
              type="number"
              step="0.01"
              className="input-field mt-1"
              value={form.precio_promo ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  precio_promo: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Unidad (kg, unidad, pack)"
            className="input-field"
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
          />
          <input
            type="number"
            placeholder="Stock (opcional)"
            className="input-field"
            value={form.stock ?? ''}
            onChange={(e) =>
              setForm({ ...form, stock: e.target.value ? parseInt(e.target.value) : null })
            }
          />
        </div>

        <SubidaFoto
          valor={form.foto_url}
          onCambiar={(url) => setForm({ ...form, foto_url: url })}
          carpeta="productos"
        />

        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-frost-700">
            <input
              type="checkbox"
              checked={form.exhibir_catalogo}
              onChange={(e) => setForm({ ...form, exhibir_catalogo: e.target.checked })}
            />
            Exhibir en catálogo público
          </label>
          <label className="flex items-center gap-2 text-sm text-frost-700">
            <input
              type="checkbox"
              checked={form.destacado}
              onChange={(e) => setForm({ ...form, destacado: e.target.checked })}
            />
            Producto destacado
          </label>
        </div>

        <div className="flex justify-between items-center pt-2">
          {producto ? (
            <button type="button" onClick={eliminar} className="text-red-600 text-sm">
              Eliminar producto
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-frost-500">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
