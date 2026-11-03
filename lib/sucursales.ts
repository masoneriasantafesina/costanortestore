// Sucursales donde se puede retirar un pedido. Para agregar, cambiar o sacar una,
// se edita solo esta lista.
export const SUCURSALES = [
  { id: 'santa_rita', nombre: 'Santa Rita', direccion: 'Pio Pandolfo 9061' },
  { id: 'gorriti', nombre: 'Gorriti', direccion: 'Gorriti 4468' },
  { id: 'colastine', nombre: 'Colastiné', direccion: 'Ruta 1 Km 2,5' },
  { id: 'rincon', nombre: 'Rincón', direccion: 'Gamboa 1421' },
] as const;

export type SucursalId = (typeof SUCURSALES)[number]['id'];

export function buscarSucursal(id: string | null | undefined) {
  return SUCURSALES.find((s) => s.id === id) ?? null;
}

export function textoSucursal(id: string | null | undefined): string {
  const s = buscarSucursal(id);
  return s ? `${s.nombre} (${s.direccion})` : '';
}

// Formas de cobro que puede informar la sucursal.
export const COBROS_SUCURSAL = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'pendiente_pago', label: 'No pagó todavía' },
] as const;
