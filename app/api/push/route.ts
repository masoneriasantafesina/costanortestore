import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { notificarSuscriptos, pushConfigurado } from '@/lib/webpush';

export const dynamic = 'force-dynamic';

// Corre en el servidor con la service_role key: la tabla push_suscripciones no se
// puede leer desde el navegador (guarda direcciones privadas de cada dispositivo).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser(token);
  if (errorSesion || !sesion.user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  const usuarioId = sesion.user.id;

  // Los usuarios pendientes de aprobación no reciben avisos de pedidos.
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', usuarioId).maybeSingle();
  if (perfil?.rol === 'nuevo') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  }

  if (body?.accion === 'suscribir') {
    const s = body.suscripcion;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
      return NextResponse.json({ error: 'Suscripción incompleta' }, { status: 400 });
    }
    const { error } = await supabase.from('push_suscripciones').upsert(
      { usuario_id: usuarioId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
      { onConflict: 'endpoint' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.accion === 'desuscribir') {
    if (!body.endpoint) return NextResponse.json({ error: 'Falta el dispositivo' }, { status: 400 });
    const { error } = await supabase
      .from('push_suscripciones')
      .delete()
      .eq('endpoint', body.endpoint)
      .eq('usuario_id', usuarioId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.accion === 'prueba') {
    if (!pushConfigurado()) {
      return NextResponse.json(
        { error: 'Faltan las claves VAPID en Vercel (NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY).' },
        { status: 500 }
      );
    }
    const r = await notificarSuscriptos(supabase, usuarioId);
    return NextResponse.json({ ok: true, ...r });
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
}
