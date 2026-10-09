import type { MarcaProducto, Producto } from '@/lib/types';

// Configuración de cada catálogo público (uno por marca). Se guarda en la tabla
// "catalogo_config" y la edita el administrador desde la sección "Catálogo".
export type CatalogoConfig = {
  marca: MarcaProducto;
  abierto: boolean;
  mensaje_cerrado: string;
  monto_minimo: number;
  banner_url: string | null;
  orden_categorias: string[];
  categorias_por_precio: string[];
};

export const MENSAJE_CERRADO_DEFECTO =
  'Por el momento no estamos tomando pedidos. ¡Volvé a visitarnos pronto!';

export function configPorDefecto(marca: MarcaProducto): CatalogoConfig {
  return {
    marca,
    abierto: true,
    mensaje_cerrado: MENSAJE_CERRADO_DEFECTO,
    monto_minimo: 0,
    banner_url: null,
    orden_categorias: [],
    categorias_por_precio: [],
  };
}

// Convierte lo que devuelve la base en una configuración completa y segura.
export function normalizarConfig(marca: MarcaProducto, fila: any): CatalogoConfig {
  const base = configPorDefecto(marca);
  if (!fila) return base;
  return {
    marca,
    abierto: fila.abierto !== false,
    mensaje_cerrado: fila.mensaje_cerrado || base.mensaje_cerrado,
    monto_minimo: Number(fila.monto_minimo) || 0,
    banner_url: fila.banner_url || null,
    orden_categorias: Array.isArray(fila.orden_categorias) ? fila.orden_categorias : [],
    categorias_por_precio: Array.isArray(fila.categorias_por_precio) ? fila.categorias_por_precio : [],
  };
}

export function precioEfectivo(p: Pick<Producto, 'precio_normal' | 'precio_promo'>): number {
  return p.precio_promo ?? p.precio_normal;
}

// Categorías en el orden elegido por el administrador. Las que no figuran en la
// lista (categorías nuevas) van al final, por orden alfabético.
export function ordenarCategorias(categorias: string[], config: CatalogoConfig): string[] {
  const posicion = (c: string) => {
    const i = config.orden_categorias.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...categorias].sort((a, b) => {
    const d = posicion(a) - posicion(b);
    return d !== 0 ? d : a.localeCompare(b, 'es');
  });
}

// Productos ordenados por categoría (según el orden de categorías) y, dentro de
// cada categoría, por el orden elegido, o de más caro a más barato si esa
// categoría está marcada para ordenarse por precio.
export function ordenarProductos<T extends Producto>(productos: T[], config: CatalogoConfig): T[] {
  const posCat = (c: string | null) => {
    if (!c) return Number.MAX_SAFE_INTEGER;
    const i = config.orden_categorias.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i;
  };
  return [...productos].sort((a, b) => {
    const dc = posCat(a.categoria) - posCat(b.categoria);
    if (dc !== 0) return dc;
    if ((a.categoria ?? '') !== (b.categoria ?? '')) {
      return (a.categoria ?? '').localeCompare(b.categoria ?? '', 'es');
    }
    if (a.categoria && config.categorias_por_precio.includes(a.categoria)) {
      const dp = precioEfectivo(b) - precioEfectivo(a);
      if (dp !== 0) return dp;
      return a.nombre.localeCompare(b.nombre, 'es');
    }
    const oa = a.orden_catalogo ?? Number.MAX_SAFE_INTEGER;
    const ob = b.orden_catalogo ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

// Dirección pública de cada catálogo.
export const RUTA_CATALOGO: Record<MarcaProducto, string> = {
  grido: '/catalogo',
  via_vana: '/catalogo/via-vana',
};
