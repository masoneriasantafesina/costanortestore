'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Cliente } from '@/lib/types';
import { UNIDAD_NEGOCIO_LABEL, UNIDAD_NEGOCIO_COLOR } from '@/lib/types';
import WhatsappBoton from '@/components/WhatsappBoton';
import { FichaCliente, FormularioCliente, HistorialPedidosCliente } from '@/components/ClienteShared';
import type { EstadisticasCliente } from '@/lib/estadisticasCliente';

export default function PosiblesClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clienteEnVista, setClienteEnVista] = useState<Cliente | null>(null);
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('estado_cliente', 'posible')
      .order('nombre_apellido');
    setClientes(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function nuevoPosible() {
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

  // Los posibles clientes todavía no tienen pedidos entregados por definición,
  // así que no calculamos kilos/días/saldo acá — no aportaría nada.
  const statsVacias: Record<string, EstadisticasCliente> = {};

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl text-frost-800">Posibles clientes</h1>
          <Link href="/admin/clientes" className="text-xs text-frost-500 underline">
            ← Ver clientes confirmados
          </Link>
        </div>
        <button onClick={nuevoPosible} className="btn-primary">
          + Nuevo posible cliente
        </button>
      </div>

      <input
        placeholder="Buscar..."
        className="input-field max-w-xs mb-4"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {cargando ? (
        <p className="text-frost-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-card border border-frost-100 divide-y divide-frost-100">
          {filtrados.map((c) => (
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
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-card ${UNIDAD_NEGOCIO_COLOR[c.unidad_negocio]}`}
                >
                  {UNIDAD_NEGOCIO_LABEL[c.unidad_negocio]}
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
          ))}
          {filtrados.length === 0 && (
            <p className="p-4 text-sm text-frost-400">No hay posibles clientes cargados todavía.</p>
          )}
        </div>
      )}

      {clienteEnVista && (
        <FichaCliente
          cliente={clienteEnVista}
          stats={statsVacias[clienteEnVista.id]}
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
          estadoNuevo="posible"
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
