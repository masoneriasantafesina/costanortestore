'use client';

import { useEffect, useState } from 'react';
import { COBROS_SUCURSAL } from '@/lib/sucursales';
import { formatearPesos } from '@/lib/formato';
import CobroDividido from '@/components/CobroDividido';
import { describirPagos, type PagoParte } from '@/lib/pagos';

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
  reporte_pagos: PagoParte[] | null;
  comprobantes: number;
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
  const [dividir, setDividir] = useState(false);
  const [pagosDivididos, setPagosDivididos] = useState<PagoParte[] | null>(null);
  const [fotos, setFotos] = useState<{ blob: Blob; vista: string }[]>([]);
  const [progreso, setProgreso] = useState('');

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

  // Achica la foto del celular (suelen pesar varios MB) antes de subirla.
  async function achicar(archivo: File): Promise<Blob> {
    const url = URL.createObjectURL(archivo);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('No se pudo leer la foto'));
        i.src = url;
      });
      const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.75)
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const nuevas: { blob: Blob; vista: string }[] = [];
    for (const archivo of Array.from(lista)) {
      try {
        const blob = await achicar(archivo);
        nuevas.push({ blob, vista: URL.createObjectURL(blob) });
      } catch {
        alert('No se pudo procesar una de las fotos.');
      }
    }
    setFotos((prev) => [...prev, ...nuevas].slice(0, 5));
  }

  async function confirmar() {
    if (dividir ? !pagosDivididos : !metodo) {
      alert(dividir ? 'Completá los dos montos para que sumen el total.' : 'Elegí cómo pagó el cliente.');
      return;
    }
    if (!por.trim()) {
      alert('Escribí tu nombre.');
      return;
    }
    const etiqueta = dividir ? describirPagos(pagosDivididos) : COBROS_SUCURSAL.find((c) => c.id === metodo)?.label ?? metodo;
    if (!confirm(`¿Confirmás que el pedido #${datos?.numero} fue ENTREGADO y el cobro fue: ${etiqueta}?`)) return;
    setEnviando(true);
    try {
      for (let i = 0; i < fotos.length; i++) {
        setProgreso(`Subiendo foto ${i + 1} de ${fotos.length}...`);
        const form = new FormData();
        form.append('foto', fotos[i].blob, 'comprobante.jpg');
        const r = await fetch(`/api/sucursal/${params.token}/foto`, { method: 'POST', body: form });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          alert(j.error ?? 'No se pudo subir una foto. Intentá de nuevo.');
          setEnviando(false);
          setProgreso('');
          return;
        }
      }
      setProgreso('');
      // Las fotos ya subidas quedan en el pedido; si hay que reintentar no se vuelven a mandar.
      setFotos([]);
      const res = await fetch(`/api/sucursal/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dividir ? { pagos: pagosDivididos, por, nota } : { metodo_pago: metodo, por, nota }),
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
          {datos.reporte_pagos
            ? ` (${describirPagos(datos.reporte_pagos)})`
            : datos.reporte_metodo_pago
            ? ` (${etiquetaCobro(datos.reporte_metodo_pago)})`
            : ''}. Queda pendiente de que
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
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setDividir(false)}
              className={`flex-1 rounded-card border px-3 py-2 text-xs font-medium ${!dividir ? 'bg-frost-100 border-frost-300 text-frost-800' : 'bg-white border-frost-200 text-frost-500'}`}
            >
              Una forma de pago
            </button>
            <button
              type="button"
              onClick={() => setDividir(true)}
              className={`flex-1 rounded-card border px-3 py-2 text-xs font-medium ${dividir ? 'bg-frost-100 border-frost-300 text-frost-800' : 'bg-white border-frost-200 text-frost-500'}`}
            >
              Dos formas de pago
            </button>
          </div>
          {dividir && (
            <div className="mb-4">
              <CobroDividido total={datos.total} onChange={setPagosDivididos} />
            </div>
          )}
          <div className={`grid grid-cols-2 gap-2 mb-4 ${dividir ? 'hidden' : ''}`}>
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
          <p className="text-xs font-semibold text-frost-500 uppercase mb-2">Fotos de comprobantes (opcional)</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.vista} alt="Comprobante" className="w-16 h-16 object-cover rounded-card border border-frost-200" />
                <button
                  type="button"
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-5"
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {fotos.length < 5 && (
            <label className="block w-full text-center text-sm font-medium text-frost-700 border border-dashed border-frost-300 rounded-card px-3 py-2.5 mb-4 cursor-pointer hover:bg-frost-50">
              📷 Sacar o elegir foto
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  agregarFotos(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
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
            {enviando ? progreso || 'Enviando...' : 'Confirmar entrega'}
          </button>
          <p className="text-xs text-frost-400 mt-2">
            Tocalo solo cuando el cliente ya se llevó el pedido.
          </p>
        </div>
      )}
    </Caja>
  );
}
