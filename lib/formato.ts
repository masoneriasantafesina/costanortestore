// Formato de precios de toda la app: punto para los miles y coma para los centavos.
// Ejemplo: 13000 -> "$ 13.000,00". Se arma a mano (y no con toLocaleString) para que
// se vea igual en cualquier celular o navegador, sin depender de su idioma.
export function formatearPesos(valor: number | null | undefined): string {
  const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
  const [entero, decimales] = Math.abs(n).toFixed(2).split('.');
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}$ ${conPuntos},${decimales}`;
}
