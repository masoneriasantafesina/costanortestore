export type MarcaProducto = 'grido' | 'via_vana';

export const MARCA_PRODUCTO_LABEL: Record<MarcaProducto, string> = {
  grido: 'Grido',
  via_vana: 'Via Vana',
};

export type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  foto_url: string | null;
  precio_normal: number;
  precio_promo: number | null;
  unidad: string;
  peso_kg: number | null;
  marca: MarcaProducto;
  stock: number | null;
  exhibir_catalogo: boolean;
  destacado: boolean;
};

export type UnidadNegocio = 'grido_store' | 'via_vana' | 'gastronomico';

export const UNIDAD_NEGOCIO_LABEL: Record<UnidadNegocio, string> = {
  grido_store: 'Grido Store',
  via_vana: 'Via Vana',
  gastronomico: 'Gastronómico',
};

export const UNIDAD_NEGOCIO_COLOR: Record<UnidadNegocio, string> = {
  grido_store: 'bg-frost-100 text-frost-700',
  via_vana: 'bg-purple-100 text-purple-700',
  gastronomico: 'bg-teal-100 text-teal-700',
};

export type CondicionIva =
  | 'responsable_inscripto'
  | 'monotributista'
  | 'exento'
  | 'consumidor_final';

export const CONDICION_IVA_LABEL: Record<CondicionIva, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributista: 'Monotributista',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
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
  notas: string | null;
  cuit: string | null;
  condicion_iva: CondicionIva | null;
  estado_cliente: 'posible' | 'confirmado';
  unidad_negocio: UnidadNegocio;
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
  unidad: string;
  peso_kg: number;
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
  pagado: boolean;
  total: number;
  orden: number;
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
