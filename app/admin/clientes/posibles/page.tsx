'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Cliente } from '@/lib/types';
import { UNIDAD_NEGOCIO_LABEL, UNIDAD_NEGOCIO_COLOR } from '@/lib/types';
import WhatsappBoton from '@/components/WhatsappBoton';
import { FichaCliente, FormularioCliente, HistorialPedidosCliente } from '@/components/ClienteShared';
import type { EstadisticasCliente } from '@/lib/estadisticasCliente';
import { registrarLog } from '@/lib/log';

type ClientePosible = Cliente & {
  cancelada?: boolean | null;
  motivo_cancelacion?: string | null;
  cancelada_en?: string | null;
};

export default function PosiblesClientesPage() {
  const [clientes, setClientes] = useState<ClientePosible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [canceladas, setCanceladas] = useState<ClientePosible[]>([]);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [busquedaCanceladas, setBusquedaCanceladas] = useState('');
  const [cancelando, setCancelando] = useState<ClientePosible | null>(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
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
    const todos = (data ?? []) as ClientePosible[];
    setClientes(todos.filter((c) => !c.cancelada));
    setCanceladas(
      todos
        .filter((c) => c.cancelada)
        .sort((a, b) => new Date(b.cancelada_en ?? 0).getTime() - new Date(a.cancelada_en ?? 0).getTime())
    );
    setCargando(false);
  }

  function pedirCancelacion(c: Cliente) {
    setClienteEnVista(null);
    setMotivo('');
    setCancelando(c as ClientePosible);
  }

  async function confirmarCancelacion() {
    if (!cancelando) return;
    const texto = motivo.trim();
    if (!texto) {
      alert('Escribí el motivo de la cancelación.');
      return;
    }
    setGuardando(true);
    const { error } = await supabase
      .from('clientes')
      .update({ cancelada: true, motivo_cancelacion: texto, cancelada_en: new Date().toISOString() })
      .eq('id', cancelando.id);
    setGuardando(false);
    if (error) {
      alert(`No se pudo cancelar la solicitud: ${error.message}`);
      return;
    }
    await registrarLog(
      'cancelar_solicitud_cliente',
      'cliente',
      cancelando.id,
      `Solicitud de ${cancelando.nombre_apellido} cancelada. Motivo: ${texto}`
    );
    setCancelando(null);
    await cargar();
  }

  async function reabrirSolicitud(c: ClientePosible) {
    if (!confirm(`¿Reabrir la solicitud de ${c.nombre_apellido}? Vuelve a la lista de posibles clientes.`)) return;
    const { error } = await supabase
      .from('clientes')
      .update({ cancelada: false, motivo_cancelacion: null, cancelada_en: null })
      .eq('id', c.id);
    if (error) {
      alert(`No se pudo reabrir: ${error.message}`);
      return;
    }
    await registrarLog('reabrir_solicitud_cliente', 'cliente', c.id, `Solicitud de ${c.nombre_apellido} reabierta`);
    await cargar();
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

  const canceladasFiltradas = canceladas.filter((c) =>
    `${c.nombre_apellido} ${c.nombre_comercio ?? ''} ${c.telefono ?? ''} ${c.localidad ?? ''} ${c.motivo_cancelacion ?? ''}`
      .toLowerCase()
      .includes(busquedaCanceladas.toLowerCase())
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
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setMostrarCanceladas((v) => !v)}
            className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
          >
            {mostrarCanceladas ? 'Ocultar canceladas' : `Canceladas (${canceladas.length})`}
          </button>
          <button onClick={nuevoPosible} className="btn-primary">
            + Nuevo posible cliente
          </button>
        </div>
      </div>

      {mostrarCanceladas && (
        <div className="bg-white rounded-card border border-frost-100 p-4 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-frost-500 mb-3">Solicitudes canceladas</p>
          <input
            type="search"
            className="input-field mb-3"
            placeholder="Buscar por nombre, comercio, teléfono, localidad o motivo"
            value={busquedaCanceladas}
            onChange={(e) => setBusquedaCanceladas(e.target.value)}
          />
          {canceladasFiltradas.length === 0 && (
            <p className="text-sm text-frost-400">
              {busquedaCanceladas.trim() ? 'No hay canceladas que coincidan.' : 'Todavía no hay solicitudes canceladas.'}
            </p>
          )}
          <div className="space-y-2">
            {canceladasFiltradas.map((c) => (
              <div key={c.id} className="bg-frost-50 rounded-card p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-frost-800 flex items-center gap-2">
                    {c.nombre_apellido}
                    <WhatsappBoton telefono={c.telefono} size={14} />
                  </p>
                  <p className="text-xs text-frost-500">
                    {c.nombre_comercio || 'Sin nombre de comercio'} · {c.localidad || 'Sin localidad'}
                    {c.telefono ? ` · ${c.telefono}` : ''}
                  </p>
                  <p className="text-sm text-frost-700 mt-1 whitespace-pre-wrap">
                    <span className="font-semibold">Motivo:</span> {c.motivo_cancelacion || 'Sin motivo'}
                  </p>
                  <p className="text-xs text-frost-400 mt-0.5">
                    Cancelada el {c.cancelada_en ? new Date(c.cancelada_en).toLocaleString('es-AR') : '—'}
                  </p>
                </div>
                <button
                  onClick={() => reabrirSolicitud(c)}
                  className="text-xs font-medium text-frost-700 border border-frost-200 rounded-card px-2 py-1 hover:bg-white shrink-0"
                >
                  Reabrir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
          onCancelarSolicitud={() => pedirCancelacion(clienteEnVista)}
          onVerHistorial={() => {
            setClienteEnVista(null);
            setClienteHistorial(clienteEnVista);
          }}
        />
      )}

      {cancelando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !guardando && setCancelando(null)} />
          <div className="relative bg-white rounded-card p-6 w-full max-w-md">
            <h2 className="font-display text-lg text-frost-800 mb-1">Cancelar solicitud</h2>
            <p className="text-sm text-frost-500 mb-3">{cancelando.nombre_apellido}</p>
            <label className="text-xs font-semibold text-frost-500 uppercase">Motivo (obligatorio)</label>
            <textarea
              className="input-field mt-1 min-h-[90px]"
              placeholder="Ej: no le interesó el precio, ya tiene otro proveedor..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setCancelando(null)} disabled={guardando} className="btn-secondary flex-1">
                Volver
              </button>
              <button
                onClick={confirmarCancelacion}
                disabled={guardando || !motivo.trim()}
                className="flex-1 text-sm font-medium text-white bg-red-600 rounded-card px-3 py-2 hover:bg-red-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Cancelar solicitud'}
              </button>
            </div>
          </div>
        </div>
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
