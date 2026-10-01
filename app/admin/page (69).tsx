'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Cliente, Cuota, Pedido } from '@/lib/types';
import { registrarLog } from '@/lib/log';

type PedidoConCuotas = Pedido & { clientes: Cliente | null; cuotas: Cuota[] };

const ESTADO_CUOTA_ESTILO: Record<Cuota['estado'], string> = {
  pendiente: 'bg-frost-100 text-frost-600',
  parcial: 'bg-yellow-100 text-yellow-700',
  pagada: 'bg-green-100 text-green-700',
};

const ESTADO_CUOTA_LABEL: Record<Cuota['estado'], string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
};

export default function CuotasPage() {
  const [planes, setPlanes] = useState<PedidoConCuotas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [verCompletados, setVerCompletados] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(*), cuotas(*)')
      .eq('financiado_cuotas', true)
      .order('creado_en', { ascending: false });
    setPlanes((data as any) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function registrarPago(pedido: PedidoConCuotas, monto: number, fecha: string) {
    if (!monto || monto <= 0) return;
    let restante = monto;
    const pendientes = [...pedido.cuotas].filter((c) => c.estado !== 'pagada').sort((a, b) => a.numero - b.numero);
    const actualizaciones: { id: string; monto_pagado: number; estado: Cuota['estado']; fecha_pago: string }[] = [];

    for (const c of pendientes) {
      if (restante <= 0) break;
      const saldoCuota = c.monto_programado - c.monto_pagado;
      const aplicado = Math.min(restante, saldoCuota);
      const nuevoPagado = Math.round((c.monto_pagado + aplicado) * 100) / 100;
      const nuevoEstado: Cuota['estado'] = nuevoPagado >= c.monto_programado - 0.01 ? 'pagada' : 'parcial';
      actualizaciones.push({ id: c.id, monto_pagado: nuevoPagado, estado: nuevoEstado, fecha_pago: fecha });
      restante -= aplicado;
    }

    await Promise.all(
      actualizaciones.map((u) =>
        supabase
          .from('cuotas')
          .update({
            monto_pagado: u.monto_pagado,
            estado: u.estado,
            fecha_pago: u.fecha_pago,
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', u.id)
      )
    );

    await registrarLog(
      'registrar_pago_cuota',
      'pedido',
      pedido.id,
      `Pedido #${pedido.numero} (${pedido.clientes?.nombre_apellido ?? pedido.nombre_contacto}): pago de $${monto.toFixed(2)} registrado el ${fecha}`
    );
    await cargar();
  }

  if (cargando) return <p className="text-frost-500">Cargando planes de pago...</p>;

  const planesCalculados = planes.map((p) => {
    const cuotasOrdenadas = [...p.cuotas].sort((a, b) => a.numero - b.numero);
    const totalFinanciado = cuotasOrdenadas.reduce((acc, c) => acc + c.monto_programado, 0);
    const totalPagado = cuotasOrdenadas.reduce((acc, c) => acc + c.monto_pagado, 0);
    const saldo = Math.round((totalFinanciado - totalPagado) * 100) / 100;
    const proxima = cuotasOrdenadas.find((c) => c.estado !== 'pagada') ?? null;
    const completado = saldo <= 0.01;
    return { pedido: p, cuotasOrdenadas, totalFinanciado, saldo, proxima, completado };
  });

  const activos = planesCalculados
    .filter((x) => !x.completado)
    .sort((a, b) => {
      const fa = a.proxima?.fecha_vencimiento ?? '9999';
      const fb = b.proxima?.fecha_vencimiento ?? '9999';
      return fa.localeCompare(fb);
    });
  const completados = planesCalculados.filter((x) => x.completado);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-frost-800">Cuotas</h1>
        <button
          onClick={() => setVerCompletados((v) => !v)}
          className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
        >
          {verCompletados ? 'Ocultar completados' : `Completados (${completados.length})`}
        </button>
      </div>

      {activos.length === 0 && (
        <p className="text-sm text-frost-400 mb-4">No hay planes de cuotas activos por ahora.</p>
      )}

      <div className="space-y-3">
        {activos.map((x) => (
          <PlanCard key={x.pedido.id} data={x} onRegistrarPago={registrarPago} />
        ))}
      </div>

      {verCompletados && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-frost-500 mb-3">Planes completados</p>
          <div className="space-y-3">
            {completados.map((x) => (
              <PlanCard key={x.pedido.id} data={x} onRegistrarPago={registrarPago} />
            ))}
            {completados.length === 0 && <p className="text-sm text-frost-400">Todavía no hay ninguno.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  data,
  onRegistrarPago,
}: {
  data: {
    pedido: PedidoConCuotas;
    cuotasOrdenadas: Cuota[];
    totalFinanciado: number;
    saldo: number;
    proxima: Cuota | null;
    completado: boolean;
  };
  onRegistrarPago: (pedido: PedidoConCuotas, monto: number, fecha: string) => Promise<void>;
}) {
  const { pedido, cuotasOrdenadas, totalFinanciado, saldo, proxima, completado } = data;
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);

  function prefillCuotaCompleta() {
    if (!proxima) return;
    const saldoCuota = proxima.monto_programado - proxima.monto_pagado;
    setMonto(saldoCuota.toFixed(2));
  }

  async function enviar() {
    const valor = Number(monto);
    if (!valor || valor <= 0) return;
    setEnviando(true);
    await onRegistrarPago(pedido, valor, fecha);
    setEnviando(false);
    setMonto('');
  }

  return (
    <div className="bg-white rounded-card border border-frost-100 p-4">
      <button onClick={() => setAbierto((v) => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <p className="text-sm font-medium text-frost-800">
            #{pedido.numero} · {pedido.clientes?.nombre_apellido ?? pedido.nombre_contacto}
          </p>
          <p className="text-xs text-frost-500 mt-0.5">
            Total ${totalFinanciado.toFixed(2)} · {cuotasOrdenadas.length} cuotas
            {!completado && proxima && (
              <> · próxima vence {new Date(proxima.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}</>
            )}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3">
          {completado ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-card bg-green-100 text-green-700">Saldado</span>
          ) : (
            <p className="text-sm font-semibold text-frost-800">Saldo ${saldo.toFixed(2)}</p>
          )}
        </div>
      </button>

      {abierto && (
        <div className="mt-3 pt-3 border-t border-frost-100">
          <div className="space-y-1.5 mb-3">
            {cuotasOrdenadas.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-frost-600">
                  Cuota {c.numero} · vence {new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-frost-500 text-xs">
                    ${c.monto_pagado.toFixed(2)} / ${c.monto_programado.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-card ${ESTADO_CUOTA_ESTILO[c.estado]}`}>
                    {ESTADO_CUOTA_LABEL[c.estado]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!completado && (
            <div className="bg-frost-50 rounded-card p-3">
              <p className="text-xs font-semibold text-frost-500 uppercase mb-2">Registrar pago</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto cobrado"
                  className="input-field flex-1"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
                <input
                  type="date"
                  className="input-field sm:w-40"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={prefillCuotaCompleta}
                  className="text-xs font-medium text-frost-600 border border-frost-200 rounded-card px-2 py-1.5 hover:bg-white"
                >
                  Pagó esta cuota (${proxima ? (proxima.monto_programado - proxima.monto_pagado).toFixed(2) : '0.00'})
                </button>
                <button
                  onClick={enviar}
                  disabled={enviando || !monto}
                  className="btn-primary text-xs px-3 py-1.5 ml-auto"
                >
                  {enviando ? 'Guardando...' : 'Registrar pago'}
                </button>
              </div>
              <p className="text-xs text-frost-400 mt-2">
                Si el monto es mayor a lo que falta de la próxima cuota, el excedente se aplica automáticamente a
                la siguiente.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
