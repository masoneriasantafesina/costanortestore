'use client';

import { useEffect, useState } from 'react';
import { COBROS_SUCURSAL } from '@/lib/sucursales';
import { formatearPesos } from '@/lib/formato';

type DatosPedido = {
  numero: number;
  estado: string;
  sucursal: string;
  cliente: string;
  comercio: string | null;
  telefono: string;
  total: number;
  notas: string | null;
  items: { nombre: string; cantidad: number; unidad: string }[];
  reporte_estado: 'pendiente' | 'rechazado' | null;
  reporte_metodo_pago: string | null;
  reporte_rechazo: string | null;
};

// Va fuera del componente: si se definiera adentro, cada tecla escrita recrearía la caja
// y los campos perderían el foco.
function Caja({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-frost-50 px-4 py-6">
      <div className="max-w-md mx-auto bg-white rounded-card border border-frost-100 p-5">{children}</div>
    </div>
  );
}

export default function PedidoSucursalPage({ params }: { params: { token: string } }) {
  const [datos, setDatos] = useState<DatosPedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [metodo, setMetodo] = useState('');
  const [por, setPor] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  async function cargar() {
    try {
      const res = await fetch(`/api/sucursal/${params.token}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? 'No se pudo abrir el pedido.');
      else setDatos(json);
    } catch {
      setError('No se pudo abrir el pedido. Revisá tu conexión.');
    }
    setCargando(false);
  }

  useEffect(() => {
    try {
      setPor(localStorage.getItem('tilda_sucursal_nombre') ?? '');
    } catch {}
    cargar();
  }, []);

  async function confirmar() {
    if (!metodo) {
      alert('Elegí cómo pagó el cliente.');
      return;
    }
    if (!por.trim()) {
      alert('Escribí tu nombre.');
      return;
    }
    const etiqueta = COBROS_SUCURSAL.find((c) => c.id === metodo)?.label ?? metodo;
    if (!confirm(`¿Confirmás que el pedido #${datos?.numero} fue ENTREGADO y el cobro fue: ${etiqueta}?`)) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/sucursal/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo_pago: metodo, por, nota }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error ?? 'No se pudo guardar. Intentá de nuevo.');
        if (res.status === 409) await cargar();
      } else {
        try {
          localStorage.setItem('tilda_sucursal_nombre', por.trim());
        } catch {}
        setListo(true);
      }
    } catch {
      alert('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    }
    setEnviando(false);
  }

  if (cargando) return <Caja><p className="text-frost-500">Cargando pedido...</p></Caja>;
  if (error || !datos) return <Caja><p className="text-red-600">{error ?? 'Este link no es válido.'}</p></Caja>;

  const cerrado = datos.estado === 'entregado' || datos.estado === 'cancelado';
  const etiquetaCobro = (id: string | null) => COBROS_SUCURSAL.find((c) => c.id === id)?.label ?? id ?? '';

  return (
    <Caja>
      <p className="text-xs font-semibold uppercase tracking-wide text-frost-500">Retira en {datos.sucursal}</p>
      <h1 className="font-display text-2xl text-frost-800 mb-1">Pedido #{datos.numero}</h1>
      <p className="text-sm text-frost-700 font-medium">{datos.cliente}</p>
      {datos.comercio && <p className="text-xs text-frost-500">{datos.comercio}</p>}
      <p className="text-xs text-frost-500 mb-4">Tel: {datos.telefono}</p>

      <div className="bg-frost-50 rounded-card p-3 mb-3 space-y-1">
        {datos.items.map((it, i) => (
          <p key={i} className="text-sm text-frost-800">
            <span className="font-semibold">{it.cantidad}</span> × {it.nombre}
          </p>
        ))}
      </div>
      {datos.notas && <p className="text-sm text-frost-600 mb-3 whitespace-pre-wrap">Nota: {datos.notas}</p>}
      <p className="flex justify-between font-semibold text-frost-800 border-t border-frost-100 pt-3 mb-5">
        <span>Total a cobrar</span>
        <span>{formatearPesos(datos.total)}</span>
      </p>

      {listo || datos.reporte_estado === 'pendiente' ? (
        <div className="rounded-card bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-3">
          ✓ Entrega informada
          {datos.reporte_metodo_pago ? ` (${etiquetaCobro(datos.reporte_metodo_pago)})` : ''}. Queda pendiente de que
          la administración lo confirme. No hace falta hacer nada más.
        </div>
      ) : cerrado ? (
        <div className="rounded-card bg-frost-100 text-frost-700 text-sm px-3 py-3">
          Este pedido ya está {datos.estado === 'entregado' ? 'entregado y cerrado' : 'cancelado'}.
        </div>
      ) : (
        <div>
          {datos.reporte_estado === 'rechazado' && (
            <div className="rounded-card bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 mb-4">
              La administración devolvió este pedido{datos.reporte_rechazo ? `: ${datos.reporte_rechazo}` : '.'} Volvé a
              informarlo.
            </div>
          )}
          <p className="text-xs font-semibold text-frost-500 uppercase mb-2">¿Cómo pagó el cliente?</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {COBROS_SUCURSAL.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setMetodo(c.id)}
                className={`rounded-card border px-3 py-3 text-sm font-medium ${
                  metodo === c.id
                    ? 'bg-frost-700 text-white border-frost-700'
                    : 'bg-white text-frost-700 border-frost-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            className="input-field mb-2"
            placeholder="Tu nombre (quién entregó)"
            value={por}
            onChange={(e) => setPor(e.target.value)}
          />
          <textarea
            className="input-field mb-4"
            placeholder="Nota (opcional): faltó algo, pagó de menos..."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <button onClick={confirmar} disabled={enviando} className="btn-primary w-full disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Confirmar entrega'}
          </button>
          <p className="text-xs text-frost-400 mt-2">
            Tocalo solo cuando el cliente ya se llevó el pedido.
          </p>
        </div>
      )}
    </Caja>
  );
}
