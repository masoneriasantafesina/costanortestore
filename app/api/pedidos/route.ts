import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { formatearPesos } from '@/lib/formato';
import { MENSAJE_CERRADO_DEFECTO } from '@/lib/catalogo';

// Esta ruta corre en el servidor (nunca en el navegador), así que puede usar
// la service_role key con seguridad. La necesitamos porque el rol público
// (anon) puede INSERTAR un pedido nuevo pero no tiene permiso de LECTURA
// sobre la tabla "pedidos" (eso queda reservado a los administradores
// logueados). Insertar y a la vez pedir de vuelta el registro creado
// requiere permiso de lectura, así que con la anon key esta operación
// fallaba en silencio. La service_role key evita las políticas RLS de forma
// segura porque solo vive en el servidor.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  }
  const { nombre_contacto, telefono_contacto, direccion_contacto, items } = body ?? {};
  const marca: 'grido' | 'via_vana' = body?.marca === 'via_vana' ? 'via_vana' : 'grido';

  if (!nombre_contacto || !telefono_contacto || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Faltan datos del pedido' }, { status: 400 });
  }

  // 1) ¿El catálogo está abierto? Se controla acá, en el servidor, y no solo en la
  //    pantalla, para que nadie pueda saltearse el cierre.
  const { data: config, error: errorConfig } = await supabase
    .from('catalogo_config')
    .select('*')
    .eq('marca', marca)
    .maybeSingle();
  if (errorConfig) {
    // Si todavía no existe la tabla (o falla la lectura) no frenamos los pedidos.
    console.error('No se pudo leer catalogo_config:', errorConfig.message);
  }
  if (config && config.abierto === false) {
    return NextResponse.json(
      { error: config.mensaje_cerrado || MENSAJE_CERRADO_DEFECTO, cerrado: true },
      { status: 403 }
    );
  }

  // 2) Cantidades válidas y sin productos repetidos.
  const cantidades = new Map<string, number>();
  for (const item of items) {
    const id = typeof item?.producto_id === 'string' ? item.producto_id : null;
    const cantidad = Number(item?.cantidad);
    if (!id || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
      return NextResponse.json({ error: 'Hay un producto con cantidad inválida' }, { status: 400 });
    }
    cantidades.set(id, (cantidades.get(id) ?? 0) + cantidad);
  }

  // 3) Los precios, nombres y pesos se toman de la base, nunca de lo que manda el
  //    navegador. Así nadie puede pedir un producto a otro precio.
  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('*')
    .in('id', Array.from(cantidades.keys()));
  if (errorProductos || !productos) {
    return NextResponse.json({ error: 'No se pudieron verificar los productos' }, { status: 500 });
  }
  const porId = new Map(productos.map((p: any) => [p.id, p]));

  const itemsAInsertar: any[] = [];
  let total = 0;
  const entradas = Array.from(cantidades.entries());
  for (const [id, cantidad] of entradas) {
    const p: any = porId.get(id);
    if (!p || p.marca !== marca || p.exhibir_catalogo === false) {
      return NextResponse.json(
        { error: 'Hay un producto que ya no está disponible. Actualizá el catálogo e intentá de nuevo.' },
        { status: 409 }
      );
    }
    if (p.agotado) {
      return NextResponse.json(
        { error: `"${p.nombre}" está sin stock. Sacalo del pedido para continuar.` },
        { status: 409 }
      );
    }
    const precio = Number(p.precio_promo ?? p.precio_normal);
    total += precio * cantidad;
    itemsAInsertar.push({
      producto_id: p.id,
      nombre_producto: p.nombre,
      precio_unitario: precio,
      cantidad,
      unidad: p.unidad ?? 'unidad',
      peso_kg: p.peso_kg ?? 0,
      subtotal: precio * cantidad,
    });
  }

  // 4) Monto mínimo de pedido.
  const minimo = Number(config?.monto_minimo) || 0;
  if (minimo > 0 && total < minimo) {
    return NextResponse.json(
      { error: `El pedido mínimo es de ${formatearPesos(minimo)}. Te faltan ${formatearPesos(minimo - total)}.` },
      { status: 422 }
    );
  }

  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({
      origen: 'catalogo_web',
      marca,
      estado: 'nuevo',
      nombre_contacto,
      telefono_contacto,
      direccion_contacto,
      total,
    })
    .select()
    .single();

  if (errorPedido || !pedido) {
    return NextResponse.json({ error: errorPedido?.message ?? 'Error al crear el pedido' }, { status: 500 });
  }

  const { error: errorItems } = await supabase
    .from('pedido_items')
    .insert(itemsAInsertar.map((it) => ({ ...it, pedido_id: pedido.id })));

  if (errorItems) {
    return NextResponse.json({ error: errorItems.message }, { status: 500 });
  }

  await supabase.from('log_auditoria').insert({
    usuario_id: null,
    usuario_email: 'catálogo público',
    accion: 'crear_pedido',
    entidad: 'pedido',
    entidad_id: pedido.id,
    detalle: `Pedido #${pedido.numero} desde el catálogo (${marca === 'via_vana' ? 'Via Vana' : 'Grido'}), total ${formatearPesos(total)}`,
  });

  return NextResponse.json({ pedido }, { status: 201 });
}
