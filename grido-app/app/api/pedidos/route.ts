import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Usamos la anon key: la tabla "pedidos" tiene una política RLS que permite
// insertar pedidos públicos solo con estado 'nuevo' y origen 'catalogo_web'.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { nombre_contacto, telefono_contacto, direccion_contacto, items } = body;

  if (!nombre_contacto || !telefono_contacto || !items || items.length === 0) {
    return NextResponse.json({ error: 'Faltan datos del pedido' }, { status: 400 });
  }

  const total = items.reduce(
    (acc: number, item: any) => acc + item.precio_unitario * item.cantidad,
    0
  );

  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({
      origen: 'catalogo_web',
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

  const itemsAInsertar = items.map((item: any) => ({
    pedido_id: pedido.id,
    producto_id: item.producto_id,
    nombre_producto: item.nombre_producto,
    precio_unitario: item.precio_unitario,
    cantidad: item.cantidad,
    subtotal: item.precio_unitario * item.cantidad,
  }));

  const { error: errorItems } = await supabase.from('pedido_items').insert(itemsAInsertar);

  if (errorItems) {
    return NextResponse.json({ error: errorItems.message }, { status: 500 });
  }

  // Opcional: acá se podría llamar a una API de WhatsApp (ej. Twilio, WhatsApp
  // Business API) para enviar un resumen al número del negocio. Se deja
  // preparado para la Fase 2.

  return NextResponse.json({ pedido }, { status: 201 });
}
