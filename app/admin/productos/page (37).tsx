'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Producto } from '@/lib/types';
import { MARCA_PRODUCTO_LABEL } from '@/lib/types';
import SubidaFoto from '@/components/SubidaFoto';

const VACIO: Omit<Producto, 'id'> = {
  nombre: '',
  categoria: '',
  descripcion: '',
  foto_url: '',
  precio_normal: 0,
  precio_promo: null,
  unidad: 'unidad',
  peso_kg: null,
  marca: 'grido',
  stock: null,
  exhibir_catalogo: true,
  destacado: false,
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [filtroMarca, setFiltroMarca] = useState<Producto['marca'] | 'todas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('productos').select('*').order('nombre');
    setProductos(data ?? []);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {productosFiltrados.length === 0 && (
            <p className="col-span-full text-sm text-frost-400">Sin resultados con ese filtro.</p>
          )}
          {productosFiltrados.map((p) => (
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
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-card ${
                      p.marca === 'via_vana' ? 'bg-purple-100 text-purple-700' : 'bg-frost-100 text-frost-600'
                    }`}
                  >
                    {p.marca === 'via_vana' ? 'Via Vana' : 'Grido'}
                  </span>
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
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Categoría"
            className="input-field"
            value={form.categoria ?? ''}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          />
          <select
            required
            className="input-field"
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value as Producto['marca'] })}
          >
            {Object.entries(MARCA_PRODUCTO_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
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

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">
            Peso por unidad de venta (kg)
          </label>
          <input
            type="number"
            step="0.001"
            placeholder="Ej: 1 si se vende suelto por kg, 0.5 si es una caja de 500g"
            className="input-field mt-1"
            value={form.peso_kg ?? ''}
            onChange={(e) =>
              setForm({ ...form, peso_kg: e.target.value ? parseFloat(e.target.value) : null })
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
