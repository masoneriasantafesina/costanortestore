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

async function usuarioQueLlama(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Ruta de "editar mi propio perfil". A propósito NO usa una policy de RLS
// que permita al usuario actualizar su propia fila de "perfiles" — eso
// abriría la puerta a que alguien, llamando directo a la API de Supabase,
// se cambie su propio "rol" a administrador. Acá, en cambio, el server
// decide con una lista blanca explícita qué campos se pueden tocar.
export async function POST(req: Request) {
  const usuario = await usuarioQueLlama(req);
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const cambios: Record<string, any> = {};
  if (typeof body.nombre === 'string') cambios.nombre = body.nombre || null;
  if (typeof body.telefono === 'string') cambios.telefono = body.telefono || null;
  if (typeof body.foto_url === 'string') cambios.foto_url = body.foto_url || null;

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('perfiles').update(cambios).eq('id', usuario.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
