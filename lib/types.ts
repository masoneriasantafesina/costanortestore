export type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  foto_url: string | null;
  precio_normal: number;
  precio_promo: number | null;
  unidad: string;
  stock: number | null;
  exhibir_catalogo: boolean;
  destacado: boolean;
};

export type Cliente = {
  id: string;
  nombre_apellido: string;
  nombre_comercio: string | null;
  direccion: string | null;
  localidad: string | null;
  maps_url: string | null;
  telefono: string | null;
  tipo_cliente: 'freezer_blanco' | 'comodato_grido';
  serie_freezer: string | null;
  foto_url: string | null;
  creado_en: string;
};

export type EstadoPedido =
  | 'nuevo'
  | 'preparacion'
  | 'preparado'
  | 'reparto'
  | 'entregado'
  | 'cancelado';

export type PedidoItem = {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre_producto: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
};

export type Pedido = {
  id: string;
  numero: number;
  origen: 'catalogo_web' | 'carga_manual';
  estado: EstadoPedido;
  cliente_id: string | null;
  nombre_contacto: string;
  telefono_contacto: string;
  direccion_contacto: string | null;
  notas: string | null;
  descuento: number;
  recargo: number;
  metodo_pago: string | null;
  total: number;
  creado_en: string;
  actualizado_en: string;
  clientes?: Cliente | null;
  pedido_items?: PedidoItem[];
};

export const ESTADOS_LABEL: Record<EstadoPedido, string> = {
  nuevo: 'Nuevo (sin asignar)',
  preparacion: 'En preparación',
  preparado: 'Preparado',
  reparto: 'En reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
