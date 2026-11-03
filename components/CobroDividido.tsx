'use client';

import { useEffect, useRef, useState } from 'react';
import { formatearPesos } from '@/lib/formato';
import { METODOS_PARTES, type PagoParte, montoATexto, parseMonto, redondear } from '@/lib/pagos';

// Editor de "dos formas de pago". Al cargar el monto de una, la otra se completa sola
// con lo que falta para llegar al total, así nunca queda un número que no cierra.
export default function CobroDividido({
  total,
  inicial,
  onChange,
}: {
  total: number;
  inicial?: PagoParte[] | null;
  onChange: (pagos: PagoParte[] | null) => void;
}) {
  const [metodoA, setMetodoA] = useState(inicial?.[0]?.metodo ?? 'efectivo');
  const [metodoB, setMetodoB] = useState(inicial?.[1]?.metodo ?? 'transferencia');
  const [textoA, setTextoA] = useState(inicial?.[0] ? montoATexto(inicial[0].monto) : '');
  const [textoB, setTextoB] = useState(inicial?.[1] ? montoATexto(inicial[1].monto) : '');

  const montoA = parseMonto(textoA);
  const montoB = parseMonto(textoB);
  const sumaOk =
    Number.isFinite(montoA) && Number.isFinite(montoB) && montoA > 0 && montoB > 0 &&
    Math.abs(montoA + montoB - total) <= 0.01;
  const mismoMetodo = metodoA === metodoB;
  const valido = sumaOk && !mismoMetodo;

  const alCambiar = useRef(onChange);
  alCambiar.current = onChange;
  useEffect(() => {
    alCambiar.current(valido ? [{ metodo: metodoA, monto: redondear(montoA) }, { metodo: metodoB, monto: redondear(montoB) }] : null);
  }, [valido, metodoA, metodoB, textoA, textoB]);

  function editarA(valor: string) {
    setTextoA(valor);
    const n = parseMonto(valor);
    setTextoB(Number.isFinite(n) && n >= 0 && n <= total ? montoATexto(total - n) : '');
  }
  function editarB(valor: string) {
    setTextoB(valor);
    const n = parseMonto(valor);
    setTextoA(Number.isFinite(n) && n >= 0 && n <= total ? montoATexto(total - n) : '');
  }

  const fila = (
    metodo: string,
    setMetodo: (v: string) => void,
    texto: string,
    editar: (v: string) => void
  ) => (
    <div className="flex gap-2">
      <select className="input-field !py-2 flex-1" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        {METODOS_PARTES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        inputMode="decimal"
        className="input-field !py-2 w-32"
        placeholder="Monto"
        value={texto}
        onChange={(e) => editar(e.target.value)}
      />
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-frost-500">Total a cobrar: {formatearPesos(total)}</p>
      {fila(metodoA, setMetodoA, textoA, editarA)}
      {fila(metodoB, setMetodoB, textoB, editarB)}
      {mismoMetodo ? (
        <p className="text-xs text-amber-700">Elegí dos formas de pago distintas.</p>
      ) : valido ? (
        <p className="text-xs text-green-700">✓ Los montos suman el total.</p>
      ) : (
        <p className="text-xs text-frost-400">Cargá el monto de una y la otra se completa sola.</p>
      )}
    </div>
  );
}
