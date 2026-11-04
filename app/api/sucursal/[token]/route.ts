import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { COBROS_SUCURSAL, textoSucursal } from '@/lib/sucursales';
import { describirPagos, validarPagos } from '@/lib/pagos';

export const dynamic = 'force-dynamic';

// Esta ruta es pública (no pide login): la protege el token largo e imposible de
// adivinar que va en el link. Corre en el servidor con la service_role key, y solo
// devuelve los datos mínimos que necesita la sucursal para preparar el pedido
// (no incluye precios unitarios ni datos de pago del cliente).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOKEN_VALIDO = /^[a-zA-Z0-9]{20,64}$/;

async function buscarPorToken(token: string) {
  if (!TOKEN_VALIDO.test(token)) return null;
  const { data } = await supabase
    .from('pedidos')
    .select('*, clientes(nombre_apellido, nombre_comercio, unidad_negocio), pedido_items(nombre_producto, cantidad, unidad)')
    .eq('token_sucursal', token)
    .maybeSingle();
  return data as any;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const p = await buscarPorToken(params.token);
  if (!p || p.tipo_entrega !== 'retiro') {
    return NextResponse.json({ error: 'Este link no es válido.' }, { status: 404 });
  }
  return NextResponse.json({
    numero: p.numero,
    estado: p.estado,
    sucursal: textoSucursal(p.sucursal),
    unidad: p.clientes?.unidad_negocio || (p.marca === 'via_vana' ? 'via_vana' : 'grido_store'),
    cliente: p.clientes?.nombre_apellido || p.nombre_contacto,
    comercio: p.clientes?.nombre_comercio || null,
    telefono: p.telefono_contacto,
    total: p.total,
    notas: p.notas,
    items: (p.pedido_items ?? []).map((i: any) => ({
      nombre: i.nombre_producto,
      cantidad: i.cantidad,
      unidad: i.unidad,
    })),
    reporte_estado: p.reporte_estado,
    reporte_metodo_pago: p.reporte_metodo_pago,
    reporte_pagos: p.reporte_pagos ?? null,
    comprobantes: Array.isArray(p.comprobantes) ? p.comprobantes.length : 0,
    reporte_rechazo: p.reporte_estado === 'rechazado' ? p.reporte_rechazo : null,
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const dividido = Array.isArray(body?.pagos);
  const metodo = dividido ? 'mixto' : String(body?.metodo_pago ?? '');
  if (!dividido && !COBROS_SUCURSAL.some((c) => c.id === metodo)) {
    return NextResponse.json({ error: 'Elegí cómo pagó el cliente.' }, { status: 400 });
  }
  const por = String(body?.por ?? '').trim().slice(0, 60);
  const nota = String(body?.nota ?? '').trim().slice(0, 300);
  if (!por) {
    return NextResponse.json({ error: 'Escribí tu nombre para saber quién entregó el pedido.' }, { status: 400 });
  }

  const p = await buscarPorToken(params.token);
  if (!p || p.tipo_entrega !== 'retiro') {
    return NextResponse.json({ error: 'Este link no es válido.' }, { status: 404 });
  }
  if (p.estado === 'entregado' || p.estado === 'cancelado') {
    return NextResponse.json({ error: 'Este pedido ya fue cerrado.' }, { status: 409 });
  }

  let pagos = null as ReturnType<typeof validarPagos>;
  if (dividido) {
    pagos = validarPagos(body.pagos, Number(p.total));
    if (!pagos) {
      return NextResponse.json(
        { error: 'Los dos montos tienen que ser de formas de pago distintas y sumar el total del pedido.' },
        { status: 400 }
      );
    }
  }

  // Solo se acepta si nadie lo informó antes (o si fue rechazado y hay que volver a informarlo).
  // El filtro va en la propia actualización para que dos toques a la vez no se pisen.
  const { data: actualizado, error } = await supabase
    .from('pedidos')
    .update({
      reporte_estado: 'pendiente',
      reporte_metodo_pago: metodo,
      reporte_pagos: pagos,
      reporte_por: por,
      reporte_nota: nota || null,
      reporte_en: new Date().toISOString(),
      reporte_rechazo: null,
    })
    .eq('id', p.id)
    .or('reporte_estado.is.null,reporte_estado.eq.rechazado')
    .select('id');
  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar. Intentá de nuevo.' }, { status: 500 });
  }
  if (!actualizado || actualizado.length === 0) {
    return NextResponse.json({ error: 'Este pedido ya fue informado por otra persona.' }, { status: 409 });
  }

  await supabase.from('log_auditoria').insert({
    usuario_id: null,
    usuario_email: `sucursal ${textoSucursal(p.sucursal)}`,
    accion: 'informar_entrega_sucursal',
    entidad: 'pedido',
    entidad_id: p.id,
    detalle: `Pedido #${p.numero}: ${por} informó entrega y cobro (${pagos ? describirPagos(pagos) : metodo}) desde la sucursal`,
  });

  return NextResponse.json({ ok: true });
}
