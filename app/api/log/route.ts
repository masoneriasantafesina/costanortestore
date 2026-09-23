import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  // El email/usuario del registro sale siempre de la sesión verificada acá
  // en el servidor, nunca de lo que mande el navegador — así nadie puede
  // hacerse pasar por otra persona en el log.
  let usuarioEmail = 'desconocido';
  let usuarioId: string | null = null;
  if (token) {
    const { data } = await supabaseAuth.auth.getUser(token);
    if (data.user) {
      usuarioEmail = data.user.email ?? 'desconocido';
      usuarioId = data.user.id;
    }
  }

  const { accion, entidad, entidad_id, detalle } = await req.json();
  if (!accion || !entidad) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  await supabaseAdmin.from('log_auditoria').insert({
    usuario_id: usuarioId,
    usuario_email: usuarioEmail,
    accion,
    entidad,
    entidad_id: entidad_id ?? null,
    detalle: detalle ?? null,
  });

  return NextResponse.json({ ok: true });
}
