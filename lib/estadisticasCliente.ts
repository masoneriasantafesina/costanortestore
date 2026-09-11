export type PedidoParaStats = {
  estado: string;
  creado_en: string;
  total: number;
  metodo_pago: string | null;
  pagado: boolean;
  pedido_items?: { cantidad: number; peso_kg: number | null }[] | null;
};

export type EstadisticasCliente = {
  kilos: number;
  diasSinPedido: number | null;
  saldo: number;
};

export function calcularEstadisticasCliente(pedidos: PedidoParaStats[]): EstadisticasCliente {
  const entregados = pedidos.filter((p) => p.estado === 'entregado');
  const activos = pedidos.filter((p) => p.estado !== 'cancelado');

  const kilos = entregados.reduce((acc, p) => {
    const kilosPedido = (p.pedido_items ?? []).reduce(
      (s, it) => s + Number(it.cantidad) * Number(it.peso_kg ?? 0),
      0
    );
    return acc + kilosPedido;
  }, 0);

  const ultimaFecha = activos.length
    ? activos.reduce((max, p) => (p.creado_en > max ? p.creado_en : max), activos[0].creado_en)
    : null;
  const diasSinPedido = ultimaFecha
    ? Math.floor((Date.now() - new Date(ultimaFecha).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const saldo = entregados
    .filter((p) => p.metodo_pago === 'cuenta_corriente' && !p.pagado)
    .reduce((acc, p) => acc + Number(p.total), 0);

  return { kilos, diasSinPedido, saldo };
}

export function colorSemaforo(dias: number | null): string {
  if (dias === null) return 'bg-frost-100 text-frost-500';
  if (dias < 14) return 'bg-green-100 text-green-700';
  if (dias <= 20) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}
