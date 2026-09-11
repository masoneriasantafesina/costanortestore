'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente } from '@/lib/types';
import MapaPreview from '@/components/MapaPreview';
import {
  calcularEstadisticasCliente,
  colorSemaforo,
  type EstadisticasCliente,
} from '@/lib/estadisticasCliente';

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
  notas: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [statsPorCliente, setStatsPorCliente] = useState<Record<string, EstadisticasCliente>>({});
  const [cargando, setCargando] = useState(true);
  const [clienteEnVista, setClienteEnVista] = useState<Cliente | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  async function cargar() {
    setCargando(true);
    const [{ data: clientesData }, { data: pedidosData }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre_apellido'),
      supabase
        .from('pedidos')
        .select('cliente_id, estado, creado_en, total, metodo_pago, pagado, pedido_items(cantidad, peso_kg)')
        .not('cliente_id', 'is', null),
    ]);

    setClientes(clientesData ?? []);

    const porCliente: Record<string, any[]> = {};
    (pedidosData ?? []).forEach((p: any) => {
      if (!porCliente[p.cliente_id]) porCliente[p.cliente_id] = [];
      porCliente[p.cliente_id].push(p);
    });
    const stats: Record<string, EstadisticasCliente> = {};
    Object.entries(porCliente).forEach(([clienteId, pedidos]) => {
      stats[clienteId] = calcularEstadisticasCliente(pedidos);
    });
    setStatsPorCliente(stats);

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
    setClienteEnVista(null);
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
          {filtrados.map((c) => {
            const stats = statsPorCliente[c.id];
            return (
              <div
                key={c.id}
                onClick={() => setClienteEnVista(c)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-frost-50 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-frost-800">{c.nombre_apellido}</p>
                  <p className="text-xs text-frost-500 truncate">
                    {c.nombre_comercio || 'Sin nombre de comercio'} · {c.localidad || 'Sin localidad'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-frost-500">
                      {stats ? `${stats.kilos.toFixed(1)} kg vendidos` : 'Sin ventas todavía'}
                    </span>
                    {stats && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-card ${colorSemaforo(
                          stats.diasSinPedido
                        )}`}
                      >
                        {stats.diasSinPedido === null ? 'Nunca pidió' : `${stats.diasSinPedido}d sin pedir`}
                      </span>
                    )}
                    {stats && stats.saldo > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-card bg-red-100 text-red-700">
                        Debe ${stats.saldo.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-card ${
                      c.tipo_cliente === 'comodato_grido'
                        ? 'bg-mango-100 text-mango-600'
                        : 'bg-frost-100 text-frost-600'
                    }`}
                  >
                    {c.tipo_cliente === 'comodato_grido' ? 'Comodato Grido' : 'Freezer blanco'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      editarCliente(c);
                    }}
                    className="text-xs font-medium text-frost-600 border border-frost-200 rounded-card px-2 py-1 hover:bg-white"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
          {filtrados.length === 0 && <p className="p-4 text-sm text-frost-400">Sin resultados.</p>}
        </div>
      )}

      {clienteEnVista && (
        <FichaCliente
          cliente={clienteEnVista}
          stats={statsPorCliente[clienteEnVista.id]}
          onCerrar={() => setClienteEnVista(null)}
          onEditar={() => editarCliente(clienteEnVista)}
        />
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

function FichaCliente({
  cliente,
  stats,
  onCerrar,
  onEditar,
}: {
  cliente: Cliente;
  stats: EstadisticasCliente | undefined;
  onCerrar: () => void;
  onEditar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative bg-white rounded-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-xl text-frost-800">{cliente.nombre_apellido}</h2>
            <p className="text-xs text-frost-500">{cliente.nombre_comercio || 'Sin nombre de comercio'}</p>
          </div>
          <button onClick={onCerrar} className="text-frost-400 text-sm">
            Cerrar
          </button>
        </div>

        <span
          className={`inline-block text-xs px-2 py-1 rounded-card mb-4 ${
            cliente.tipo_cliente === 'comodato_grido'
              ? 'bg-mango-100 text-mango-600'
              : 'bg-frost-100 text-frost-600'
          }`}
        >
          {cliente.tipo_cliente === 'comodato_grido' ? 'Comodato Grido' : 'Freezer blanco'}
        </span>

        <div className="bg-frost-50 rounded-card p-3 grid grid-cols-3 gap-2 text-center mb-4">
          <div>
            <p className="text-[10px] uppercase text-frost-500 font-semibold">Kilos vendidos</p>
            <p className="text-sm font-semibold text-frost-800 mt-1">
              {stats ? `${stats.kilos.toFixed(1)} kg` : '0 kg'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-frost-500 font-semibold">Sin pedir hace</p>
            <p
              className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-card ${colorSemaforo(
                stats?.diasSinPedido ?? null
              )}`}
            >
              {!stats || stats.diasSinPedido === null ? 'Nunca pidió' : `${stats.diasSinPedido} días`}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-frost-500 font-semibold">Debe</p>
            <p
              className={`text-sm font-semibold mt-1 ${
                (stats?.saldo ?? 0) > 0 ? 'text-red-600' : 'text-frost-800'
              }`}
            >
              ${(stats?.saldo ?? 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-frost-700 mb-4">
          <p>
            <span className="text-frost-400">Dirección:</span> {cliente.direccion || '—'}
            {cliente.localidad ? `, ${cliente.localidad}` : ''}
          </p>
          {cliente.maps_url && (
            <div className="space-y-1">
              <MapaPreview mapsUrl={cliente.maps_url} />
              <a
                href={cliente.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-frost-600 underline text-sm inline-block"
              >
                Ver en Google Maps
              </a>
            </div>
          )}
          <p>
            <span className="text-frost-400">Teléfono:</span> {cliente.telefono || '—'}
          </p>
          {cliente.tipo_cliente === 'comodato_grido' && (
            <p>
              <span className="text-frost-400">Serie del freezer:</span> {cliente.serie_freezer || '—'}
            </p>
          )}
        </div>

        {cliente.notas && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-frost-500 uppercase mb-1">Notas</p>
            <p className="text-sm text-frost-700 whitespace-pre-wrap bg-frost-50 rounded-card p-3">
              {cliente.notas}
            </p>
          </div>
        )}

        <button onClick={onEditar} className="btn-secondary w-full">
          Editar cliente
        </button>
      </div>
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
  const [stats, setStats] = useState<EstadisticasCliente | null>(null);
  const [cargandoStats, setCargandoStats] = useState(!!cliente);

  useEffect(() => {
    if (!cliente) return;
    async function cargarStats() {
      const { data } = await supabase
        .from('pedidos')
        .select('estado, creado_en, total, metodo_pago, pagado, pedido_items(cantidad, peso_kg)')
        .eq('cliente_id', cliente!.id);
      setStats(calcularEstadisticasCliente((data as any) ?? []));
      setCargandoStats(false);
    }
    cargarStats();
  }, [cliente]);

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

        {cliente && (
          <div className="bg-frost-50 rounded-card p-3 grid grid-cols-3 gap-2 text-center mb-1">
            <div>
              <p className="text-[10px] uppercase text-frost-500 font-semibold">Kilos vendidos</p>
              <p className="text-sm font-semibold text-frost-800 mt-1">
                {cargandoStats ? '...' : `${stats?.kilos.toFixed(1)} kg`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-frost-500 font-semibold">Sin pedir hace</p>
              <p
                className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-card ${colorSemaforo(
                  stats?.diasSinPedido ?? null
                )}`}
              >
                {cargandoStats
                  ? '...'
                  : stats?.diasSinPedido === null
                    ? 'Nunca pidió'
                    : `${stats?.diasSinPedido} días`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-frost-500 font-semibold">Debe</p>
              <p
                className={`text-sm font-semibold mt-1 ${
                  (stats?.saldo ?? 0) > 0 ? 'text-red-600' : 'text-frost-800'
                }`}
              >
                {cargandoStats ? '...' : `$${stats?.saldo.toFixed(2)}`}
              </p>
            </div>
          </div>
        )}

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
        <MapaPreview mapsUrl={form.maps_url} />
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

        <div>
          <label className="text-xs font-semibold text-frost-500 uppercase">Notas</label>
          <textarea
            placeholder="Anotaciones internas sobre este cliente..."
            className="input-field mt-1"
            rows={3}
            value={form.notas ?? ''}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
        </div>

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
