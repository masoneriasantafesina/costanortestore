'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente, Pedido } from '@/lib/types';
import { CONDICION_IVA_LABEL, ESTADOS_LABEL } from '@/lib/types';
import MapaPreview from '@/components/MapaPreview';
import WhatsappBoton from '@/components/WhatsappBoton';
import {
  calcularEstadisticasCliente,
  colorSemaforo,
  type EstadisticasCliente,
} from '@/lib/estadisticasCliente';

export function clienteVacio(estadoCliente: Cliente['estado_cliente']): Omit<Cliente, 'id' | 'creado_en'> {
  return {
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
    cuit: '',
    condicion_iva: null,
    estado_cliente: estadoCliente,
  };
}

export function FichaCliente({
  cliente,
  stats,
  onCerrar,
  onEditar,
  onVerHistorial,
}: {
  cliente: Cliente;
  stats: EstadisticasCliente | undefined;
  onCerrar: () => void;
  onEditar: () => void;
  onVerHistorial: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative bg-white rounded-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-xl text-frost-800 flex items-center gap-2">
              {cliente.nombre_apellido}
              <WhatsappBoton telefono={cliente.telefono} />
            </h2>
            <p className="text-xs text-frost-500">{cliente.nombre_comercio || 'Sin nombre de comercio'}</p>
          </div>
          <button onClick={onCerrar} className="text-frost-400 text-sm">
            Cerrar
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {cliente.estado_cliente === 'posible' && (
            <span className="inline-block text-xs px-2 py-1 rounded-card bg-yellow-100 text-yellow-700">
              Posible cliente
            </span>
          )}
          <span
            className={`inline-block text-xs px-2 py-1 rounded-card ${
              cliente.tipo_cliente === 'comodato_grido'
                ? 'bg-mango-100 text-mango-600'
                : 'bg-frost-100 text-frost-600'
            }`}
          >
            {cliente.tipo_cliente === 'comodato_grido' ? 'Comodato Grido' : 'Freezer blanco'}
          </span>
        </div>

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
          <p>
            <span className="text-frost-400">CUIT:</span> {cliente.cuit || '—'}
          </p>
          <p>
            <span className="text-frost-400">Condición de IVA:</span>{' '}
            {cliente.condicion_iva ? CONDICION_IVA_LABEL[cliente.condicion_iva] : '—'}
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

        <div className="flex gap-2">
          <button
            onClick={onVerHistorial}
            className="flex-1 text-sm font-medium text-frost-700 border border-frost-200 rounded-card px-3 py-2 hover:bg-frost-50"
          >
            Ver pedidos históricos
          </button>
          <button onClick={onEditar} className="btn-secondary flex-1">
            Editar cliente
          </button>
        </div>
      </div>
    </div>
  );
}

export function FormularioCliente({
  cliente,
  onCerrar,
  onGuardado,
  estadoNuevo = 'confirmado',
}: {
  cliente: Cliente | null;
  onCerrar: () => void;
  onGuardado: () => void;
  estadoNuevo?: Cliente['estado_cliente'];
}) {
  const [form, setForm] = useState(cliente ?? clienteVacio(estadoNuevo));
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
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

  async function confirmarCliente() {
    if (!cliente) return;
    setConfirmando(true);
    await supabase.from('clientes').update({ estado_cliente: 'confirmado' }).eq('id', cliente.id);
    setConfirmando(false);
    onGuardado();
  }

  const esPosible = cliente?.estado_cliente === 'posible';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <form
        onSubmit={guardar}
        className="relative bg-white rounded-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-3"
      >
        <h2 className="font-display text-xl text-frost-800 mb-2">
          {cliente ? 'Editar cliente' : estadoNuevo === 'posible' ? 'Nuevo posible cliente' : 'Nuevo cliente'}
        </h2>

        {esPosible && (
          <button
            type="button"
            onClick={confirmarCliente}
            disabled={confirmando}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-card text-sm"
          >
            {confirmando ? 'Confirmando...' : '✓ CONFIRMAR CLIENTE'}
          </button>
        )}

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
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="CUIT (ej: 20-12345678-9)"
            className="input-field"
            value={form.cuit ?? ''}
            onChange={(e) => setForm({ ...form, cuit: e.target.value })}
          />
          <select
            className="input-field"
            value={form.condicion_iva ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                condicion_iva: (e.target.value || null) as Cliente['condicion_iva'],
              })
            }
          >
            <option value="">Condición de IVA...</option>
            {Object.entries(CONDICION_IVA_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
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

export function HistorialPedidosCliente({ cliente, onCerrar }: { cliente: Cliente; onCerrar: () => void }) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*)')
        .eq('cliente_id', cliente.id)
        .order('creado_en', { ascending: false });
      setPedidos((data as any) ?? []);
    }
    cargar();
  }, [cliente.id]);

  function colorEstado(estado: string) {
    if (estado === 'entregado') return 'bg-green-100 text-green-700';
    if (estado === 'cancelado') return 'bg-red-100 text-red-700';
    return 'bg-frost-100 text-frost-600';
  }

  function kilosDe(p: Pedido) {
    return (p.pedido_items ?? []).reduce((acc, it) => acc + it.cantidad * (it.peso_kg ?? 0), 0);
  }

  function etiquetaCobro(p: Pedido) {
    if (!p.metodo_pago) return 'Sin cobro definido';
    if (p.metodo_pago === 'cuenta_corriente') return p.pagado ? 'Cta. cte. (pagado)' : 'Cta. cte. (pendiente)';
    return p.metodo_pago.charAt(0).toUpperCase() + p.metodo_pago.slice(1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative bg-white rounded-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-xl text-frost-800">Pedidos de {cliente.nombre_apellido}</h2>
            <p className="text-xs text-frost-500">
              {pedidos ? `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} en total` : 'Cargando...'}
            </p>
          </div>
          <button onClick={onCerrar} className="text-frost-400 text-sm">
            Cerrar
          </button>
        </div>

        {pedidos === null && <p className="text-frost-500 text-sm">Cargando...</p>}
        {pedidos?.length === 0 && (
          <p className="text-frost-400 text-sm">Este cliente todavía no tiene pedidos registrados.</p>
        )}

        <div className="space-y-2">
          {pedidos?.map((p) => {
            const expandido = expandidoId === p.id;
            return (
              <div key={p.id} className="bg-frost-50 rounded-card overflow-hidden">
                <button
                  onClick={() => setExpandidoId(expandido ? null : p.id)}
                  className="w-full flex items-center gap-2 p-3 text-left"
                >
                  <span className="text-xs text-frost-600 shrink-0 w-16">
                    {new Date(p.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-card shrink-0 ${colorEstado(p.estado)}`}>
                    {ESTADOS_LABEL[p.estado]}
                  </span>
                  <span className="text-xs text-frost-500 flex-1 truncate">{etiquetaCobro(p)}</span>
                  <span className="text-xs text-frost-500 shrink-0">{kilosDe(p).toFixed(1)} kg</span>
                  <span className="text-sm font-semibold text-frost-800 shrink-0">${p.total.toFixed(2)}</span>
                </button>

                {expandido && (
                  <div className="px-3 pb-3 border-t border-frost-100 pt-2">
                    <p className="text-xs text-frost-400 mb-1">Pedido #{p.numero}</p>
                    <div className="text-xs text-frost-600 space-y-0.5">
                      {p.pedido_items?.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            {item.cantidad} × {item.nombre_producto}
                          </span>
                          <span>${item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
