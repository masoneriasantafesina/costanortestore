import type { Pedido } from '@/lib/types';

// Genera una imagen (PNG) del pedido, pensada para que una sucursal lo prepare,
// y la comparte por WhatsApp (u otra app) desde el celular. En computadora, donde
// no se pueden adjuntar archivos a WhatsApp desde el navegador, la descarga.

const ANCHO = 720; // ancho lógico; se dibuja al doble para que quede nítida
const ESCALA = 2;
const MARGEN = 32;
const NAVY = '#092868';
const FUENTE = 'Arial, Helvetica, sans-serif';

let logoCache: Promise<HTMLImageElement | null> | null = null;

function cargarLogo(): Promise<HTMLImageElement | null> {
  if (!logoCache) {
    logoCache = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/brand/tilda-wordmark-v2.png';
    });
  }
  return logoCache;
}

// Precarga el logo para que al tocar "Compartir" no haya demora antes de abrir
// el menú de compartir (algunos celulares lo bloquean si tarda demasiado).
export function precargarLogoPedido() {
  void cargarLogo();
}

function partirTexto(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= maxAncho || !actual) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

function formatearPesos(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generarImagenPedido(pedido: Pedido): Promise<Blob> {
  const logo = await cargarLogo();
  const items = pedido.pedido_items ?? [];

  const nombreCliente = pedido.clientes?.nombre_apellido || pedido.nombre_contacto || 'Sin nombre';
  const comercio = pedido.clientes?.nombre_comercio || '';
  const telefono = pedido.clientes?.telefono || pedido.telefono_contacto || '';
  const pesoTotal = items.reduce((acc, it) => acc + it.cantidad * (it.peso_kg ?? 0), 0);

  // --- Primera pasada: medir todo para saber el alto de la imagen ---
  const medidor = document.createElement('canvas').getContext('2d')!;
  const anchoUtil = ANCHO - MARGEN * 2;

  const COL_CHECK = 34; // casilla para tildar
  const COL_CANT = 78; // cantidad
  const xNombre = MARGEN + COL_CHECK + COL_CANT;
  const COL_PRECIO = 160; // precio: subtotal y precio unitario
  const anchoNombre = ANCHO - MARGEN - xNombre - COL_PRECIO;

  medidor.font = `bold 22px ${FUENTE}`;
  const filas = items.map((it) => {
    const lineas = partirTexto(medidor, it.nombre_producto, anchoNombre);
    return { it, lineas, alto: Math.max(64, lineas.length * 28 + 26) };
  });

  medidor.font = `18px ${FUENTE}`;
  const lineasNotas = pedido.notas ? partirTexto(medidor, pedido.notas, anchoUtil - 28) : [];

  const ALTO_HEADER = 120;
  let alto = ALTO_HEADER + 28;
  alto += 36 + (comercio ? 28 : 0) + (telefono ? 28 : 0) + 20; // bloque cliente
  if (pedido.cajon) alto += 52;
  if (lineasNotas.length) alto += lineasNotas.length * 24 + 44;
  alto += 34 + 56; // título "Para preparar" + encabezado de tabla
  alto += filas.reduce((acc, f) => acc + f.alto, 0);
  alto += 24 + 130; // totales
  alto += 56; // pie

  // --- Segunda pasada: dibujar ---
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO * ESCALA;
  canvas.height = alto * ESCALA;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ESCALA, ESCALA);
  ctx.textBaseline = 'alphabetic';

  // Fondo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO, alto);

  // Encabezado azul con logo y número de pedido
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, ANCHO, ALTO_HEADER);
  if (logo) {
    const altoLogo = 86;
    const anchoLogo = (logo.width / logo.height) * altoLogo;
    ctx.drawImage(logo, MARGEN, (ALTO_HEADER - altoLogo) / 2, anchoLogo, altoLogo);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 40px ${FUENTE}`;
  ctx.fillText(`Pedido #${pedido.numero}`, ANCHO - MARGEN, 62);
  ctx.font = `18px ${FUENTE}`;
  ctx.fillStyle = '#adc7f2';
  ctx.fillText(
    new Date(pedido.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
    ANCHO - MARGEN,
    92
  );
  ctx.textAlign = 'left';

  let y = ALTO_HEADER + 28;

  // Cliente
  ctx.fillStyle = '#12191c';
  ctx.font = `bold 28px ${FUENTE}`;
  y += 28;
  ctx.fillText(nombreCliente, MARGEN, y);
  ctx.fillStyle = '#4b5b73';
  ctx.font = `20px ${FUENTE}`;
  if (comercio) {
    y += 28;
    ctx.fillText(comercio, MARGEN, y);
  }
  if (telefono) {
    y += 28;
    ctx.fillText(`Tel: ${telefono}`, MARGEN, y);
  }
  y += 20;

  // Cajón
  if (pedido.cajon) {
    ctx.fillStyle = '#fff1c2';
    ctx.fillRect(MARGEN, y, anchoUtil, 40);
    ctx.fillStyle = '#7a4d00';
    ctx.font = `bold 20px ${FUENTE}`;
    ctx.fillText(`Cajón(es): ${pedido.cajon}`, MARGEN + 14, y + 27);
    y += 52;
  }

  // Notas
  if (lineasNotas.length) {
    const altoCaja = lineasNotas.length * 24 + 32;
    ctx.fillStyle = '#eef3fc';
    ctx.fillRect(MARGEN, y, anchoUtil, altoCaja);
    ctx.fillStyle = NAVY;
    ctx.font = `18px ${FUENTE}`;
    lineasNotas.forEach((linea, i) => {
      ctx.fillText(linea, MARGEN + 14, y + 28 + i * 24);
    });
    y += altoCaja + 12;
  }

  // Título de la tabla
  y += 34;
  ctx.fillStyle = NAVY;
  ctx.font = `bold 22px ${FUENTE}`;
  ctx.fillText('PARA PREPARAR', MARGEN, y);
  y += 12;
  ctx.fillStyle = NAVY;
  ctx.fillRect(MARGEN, y, anchoUtil, 3);
  y += 44;

  // Filas de productos
  filas.forEach(({ it, lineas, alto: altoFila }, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f5f8fd';
      ctx.fillRect(MARGEN - 8, y - 30, anchoUtil + 16, altoFila);
    }
    // casilla para tildar
    ctx.strokeStyle = '#84a7e8';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGEN, y - 20, 22, 22);
    // cantidad
    ctx.fillStyle = NAVY;
    ctx.font = `bold 30px ${FUENTE}`;
    ctx.fillText(`${it.cantidad}`, MARGEN + COL_CHECK, y + 2);
    ctx.fillStyle = '#6b7a90';
    ctx.font = `15px ${FUENTE}`;
    ctx.fillText(it.unidad || '', MARGEN + COL_CHECK, y + 20);
    // nombre
    ctx.fillStyle = '#12191c';
    ctx.font = `bold 22px ${FUENTE}`;
    lineas.forEach((linea, i) => {
      ctx.fillText(linea, xNombre, y + i * 28);
    });
    // precios (alineados a la derecha)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#12191c';
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(formatearPesos(it.subtotal), ANCHO - MARGEN, y);
    ctx.fillStyle = '#6b7a90';
    ctx.font = `15px ${FUENTE}`;
    ctx.fillText(`${it.cantidad} × ${formatearPesos(it.precio_unitario)}`, ANCHO - MARGEN, y + 22);
    ctx.textAlign = 'left';
    y += altoFila;
  });

  // Totales
  y += 4;
  ctx.fillStyle = '#d6e3f9';
  ctx.fillRect(MARGEN, y, anchoUtil, 2);
  y += 36;
  ctx.fillStyle = '#4b5b73';
  ctx.font = `20px ${FUENTE}`;
  ctx.fillText('Peso total', MARGEN, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${pesoTotal.toFixed(2)} kg`, ANCHO - MARGEN, y);
  ctx.textAlign = 'left';
  y += 42;
  ctx.fillStyle = '#12191c';
  ctx.font = `bold 30px ${FUENTE}`;
  ctx.fillText('Total', MARGEN, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatearPesos(pedido.total), ANCHO - MARGEN, y);
  ctx.textAlign = 'left';
  y += 38;
  ctx.font = `bold 20px ${FUENTE}`;
  if (pedido.pagado) {
    ctx.fillStyle = '#15803d';
    ctx.fillText('PAGADO', MARGEN, y);
  } else {
    ctx.fillStyle = '#b45309';
    ctx.fillText('PENDIENTE DE PAGO', MARGEN, y);
  }

  // Pie
  ctx.fillStyle = '#84a7e8';
  ctx.font = `15px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.fillText('Tild@ · Costa Norte Mayorista', ANCHO / 2, alto - 22);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      'image/png'
    );
  });
}

export type ResultadoCompartir = 'compartido' | 'descargado' | 'cancelado';

export async function compartirPedido(pedido: Pedido): Promise<ResultadoCompartir> {
  const blob = await generarImagenPedido(pedido);
  const archivo = new File([blob], `pedido-${pedido.numero}.png`, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: `Pedido #${pedido.numero}` });
      return 'compartido';
    } catch (e) {
      const nombre = (e as DOMException)?.name;
      if (nombre === 'AbortError') return 'cancelado';
      // Si el navegador bloqueó el menú de compartir, caemos a la descarga.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedido-${pedido.numero}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'descargado';
}
