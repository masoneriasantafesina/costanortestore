'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Cliente } from '@/lib/types';
import WhatsappBoton from '@/components/WhatsappBoton';
import { calcularEstadisticasCliente, colorSemaforo, type EstadisticasCliente } from '@/lib/estadisticasCliente';
import { FichaCliente, FormularioCliente, HistorialPedidosCliente, clienteVacio } from '@/components/ClienteShared';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [statsPorCliente, setStatsPorCliente] = useState<Record<string, EstadisticasCliente>>({});
  const [cargando, setCargando] = useState(true);
  const [clienteEnVista, setClienteEnVista] = useState<Cliente | null>(null);
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  async function cargar() {
    setCargando(true);
    const [{ data: clientesData }, { data: pedidosData }] = await Promise.all([
      supabase.from('clientes').select('*').eq('estado_cliente', 'confirmado').order('nombre_apellido'),
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
        <div className="flex gap-2">
          <Link
            href="/admin/clientes/posibles"
            className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-2 hover:bg-frost-50"
          >
            Posibles clientes
          </Link>
          <button onClick={nuevoCliente} className="btn-primary">
            + Nuevo cliente
          </button>
        </div>
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
                  <p className="text-sm font-medium text-frost-800 flex items-center gap-2">
                    {c.nombre_apellido}
                    <WhatsappBoton telefono={c.telefono} size={14} />
                  </p>
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
          onVerHistorial={() => {
            setClienteEnVista(null);
            setClienteHistorial(clienteEnVista);
          }}
        />
      )}

      {clienteHistorial && (
        <HistorialPedidosCliente cliente={clienteHistorial} onCerrar={() => setClienteHistorial(null)} />
      )}

      {formAbierto && (
        <FormularioCliente
          cliente={editando}
          estadoNuevo="confirmado"
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
