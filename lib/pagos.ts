import { formatearPesos } from '@/lib/formato';

// Un cobro dividido en dos formas de pago, por ejemplo $60.000 en efectivo + $40.000 por transferencia.
export type PagoParte = { metodo: string; monto: number };

export const METODOS_PARTES = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'cheque', label: 'Cheque' },
] as const;

export const LABEL_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  pendiente_pago: 'Pendiente de pago',
  mixto: 'Mixto',
  cuotas: 'Plan de cuotas',
};

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// Acepta "1234,56", "1.234,56", "1234.56" y "13.000" (el punto de miles argentino).
export function parseMonto(texto: string): number {
  const t = texto.trim().replace(/\s/g, '').replace('$', '');
  if (!t) return NaN;
  let n = t;
  if (t.includes(',')) n = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) ?? []).length > 1) n = t.replace(/\./g, '');
  else if (/^\d{1,3}\.\d{3}$/.test(t)) n = t.replace('.', '');
  return Number(n);
}

export function montoATexto(n: number): string {
  return String(redondear(n)).replace('.', ',');
}

// Verifica (también en el servidor) que sean exactamente dos formas distintas,
// con montos positivos que sumen el total del pedido.
export function validarPagos(pagos: unknown, total: number): PagoParte[] | null {
  if (!Array.isArray(pagos) || pagos.length !== 2) return null;
  const limpios: PagoParte[] = [];
  for (const p of pagos) {
    const metodo = String((p as any)?.metodo ?? '');
    const monto = redondear(Number((p as any)?.monto));
    if (!METODOS_PARTES.some((m) => m.id === metodo)) return null;
    if (!Number.isFinite(monto) || monto <= 0) return null;
    limpios.push({ metodo, monto });
  }
  if (limpios[0].metodo === limpios[1].metodo) return null;
  if (Math.abs(limpios[0].monto + limpios[1].monto - total) > 0.01) return null;
  return limpios;
}

export function describirPagos(pagos: PagoParte[] | null | undefined): string {
  if (!pagos || pagos.length === 0) return '';
  return pagos.map((p) => `${LABEL_METODO[p.metodo] ?? p.metodo} ${formatearPesos(p.monto)}`).join(' + ');
}
