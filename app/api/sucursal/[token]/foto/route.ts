import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOKEN_VALIDO = /^[a-zA-Z0-9]{20,64}$/;
const MAX_FOTOS = 5;
const MAX_BYTES = 3 * 1024 * 1024;

// Recibe una foto de comprobante desde el link de la sucursal. La página ya la achica
// antes de mandarla; acá se vuelve a verificar tamaño, tipo y que el pedido siga abierto.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!TOKEN_VALIDO.test(params.token)) {
    return NextResponse.json({ error: 'Este link no es válido.' }, { status: 404 });
  }
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, numero, estado, tipo_entrega, comprobantes')
    .eq('token_sucursal', params.token)
    .maybeSingle();
  if (!pedido || pedido.tipo_entrega !== 'retiro') {
    return NextResponse.json({ error: 'Este link no es válido.' }, { status: 404 });
  }
  if (pedido.estado === 'entregado' || pedido.estado === 'cancelado') {
    return NextResponse.json({ error: 'Este pedido ya fue cerrado.' }, { status: 409 });
  }
  const actuales: string[] = Array.isArray(pedido.comprobantes) ? pedido.comprobantes : [];
  if (actuales.length >= MAX_FOTOS) {
    return NextResponse.json({ error: `Ya hay ${MAX_FOTOS} fotos en este pedido.` }, { status: 400 });
  }

  let archivo: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('foto');
    archivo = f instanceof File ? f : null;
  } catch {
    archivo = null;
  }
  if (!archivo || !archivo.type.startsWith('image/')) {
    return NextResponse.json({ error: 'La foto no es válida.' }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La foto es demasiado pesada.' }, { status: 413 });
  }

  const ruta = `comprobantes/${pedido.id}/${randomUUID()}.jpg`;
  const { error: errorSubida } = await supabase.storage
    .from('fotos')
    .upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: 'image/jpeg' });
  if (errorSubida) {
    return NextResponse.json({ error: 'No se pudo subir la foto. Intentá de nuevo.' }, { status: 500 });
  }
  const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(ruta);
  const url = urlData.publicUrl;

  const { error: errorGuardar } = await supabase
    .from('pedidos')
    .update({ comprobantes: [...actuales, url] })
    .eq('id', pedido.id);
  if (errorGuardar) {
    return NextResponse.json({ error: 'No se pudo guardar la foto en el pedido.' }, { status: 500 });
  }
  return NextResponse.json({ url });
}
