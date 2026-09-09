'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente } from '@/lib/types';

const VACIO: Omit<Cliente, 'id' | 'creado_en'> = {
  nombre_apellido: '',
  nombre_comercio: '',
  direccion: '',
  localidad: '',
  maps_url: '',
  telefono: '',
  tipo_cliente: 'freezer_blanco',
  serie_freezer: '',
  foto_url: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('clientes').select('*').order('nombre_apellido');
    setClientes(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function nuevoCliente() {
    setEditando(null);
    setFormAbierto(true);
  }

  function editarCliente(c: Cliente) {
    setEditando(c);
    setFormAbierto(true);
  }

  const filtrados = clientes.filter((c) =>
    `${c.nombre_apellido} ${c.nombre_comercio}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Clientes</h1>
        <button onClick={nuevoCliente} className="btn-primary">
          + Nuevo cliente
        </button>
      </div>

      <input
        placeholder="Buscar cliente..."
        className="input-field max-w-xs mb-4"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-card border border-frost-100 divide-y divide-frost-100">
          {filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => editarCliente(c)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-frost-50"
            >
              <div>
                <p className="text-sm font-medium text-frost-800">
                  {c.nombre_comercio || c.nombre_apellido}
                </p>
                <p className="text-xs text-frost-500">
                  {c.nombre_apellido} · {c.localidad || 'Sin localidad'}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-card ${
                  c.tipo_cliente === 'comodato_grido'
                    ? 'bg-mango-100 text-mango-600'
                    : 'bg-frost-100 text-frost-600'
                }`}
              >
                {c.tipo_cliente === 'comodato_grido' ? 'Comodato Grido' : 'Freezer blanco'}
              </span>
            </button>
          ))}
          {filtrados.length === 0 && <p className="p-4 text-sm text-frost-400">Sin resultados.</p>}
        </div>
      )}

      {formAbierto && (
        <FormularioCliente
          cliente={editando}
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

function FormularioCliente({
  cliente,
  onCerrar,
  onGuardado,
}: {
  cliente: Cliente | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState(cliente ?? VACIO);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    if (cliente) {
      await supabase.from('clientes').update(form).eq('id', cliente.id);
    } else {
      await supabase.from('clientes').insert(form);
    }
    setGuardando(false);
    onGuardado();
  }

  async function eliminar() {
    if (!cliente) return;
    if (!confirm('¿Eliminar este cliente?')) return;
    await supabase.from('clientes').delete().eq('id', cliente.id);
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
          {cliente ? 'Editar cliente' : 'Nuevo cliente'}
        </h2>

        <input
          required
          placeholder="Nombre y apellido / razón social"
          className="input-field"
          value={form.nombre_apellido}
          onChange={(e) => setForm({ ...form, nombre_apellido: e.target.value })}
        />
        <input
          placeholder="Nombre del comercio"
          className="input-field"
          value={form.nombre_comercio ?? ''}
          onChange={(e) => setForm({ ...form, nombre_comercio: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Dirección"
            className="input-field"
            value={form.direccion ?? ''}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />
          <input
            placeholder="Localidad"
            className="input-field"
            value={form.localidad ?? ''}
            onChange={(e) => setForm({ ...form, localidad: e.target.value })}
          />
        </div>
        <input
          placeholder="Link de Google Maps"
          className="input-field"
          value={form.maps_url ?? ''}
          onChange={(e) => setForm({ ...form, maps_url: e.target.value })}
        />
        <input
          placeholder="Teléfono / celular"
          className="input-field"
          value={form.telefono ?? ''}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Tipo de cliente</label>
          <select
            className="input-field mt-1"
            value={form.tipo_cliente}
            onChange={(e) =>
              setForm({ ...form, tipo_cliente: e.target.value as Cliente['tipo_cliente'] })
            }
          >
            <option value="freezer_blanco">Freezer blanco</option>
            <option value="comodato_grido">Comodato Grido</option>
          </select>
        </div>
        {form.tipo_cliente === 'comodato_grido' && (
          <input
            placeholder="Número de serie del freezer"
            className="input-field"
            value={form.serie_freezer ?? ''}
            onChange={(e) => setForm({ ...form, serie_freezer: e.target.value })}
          />
        )}
        <input
          placeholder="URL de la foto (subida a Supabase Storage)"
          className="input-field"
          value={form.foto_url ?? ''}
          onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
        />

        <div className="flex justify-between items-center pt-2">
          {cliente ? (
            <button type="button" onClick={eliminar} className="text-red-600 text-sm">
              Eliminar cliente
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
