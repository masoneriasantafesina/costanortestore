import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Traduce "nombre de usuario" -> email interno antes de intentar el login.
// Se llama sin sesión (todavía nadie inició sesión en este punto), así que
// usa la service role key para poder leer "perfiles" sin RLS. Siempre
// responde 200, exista o no el usuario, para no revelar con un código de
// error distinto qué nombres de usuario están registrados.
export async function POST(req: Request) {
  const { nombreUsuario } = await req.json();
  if (!nombreUsuario) {
    return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 });
  }

  const normalizado = String(nombreUsuario).trim().toLowerCase();

  const { data } = await supabaseAdmin
    .from('perfiles')
    .select('email')
    .eq('nombre_usuario', normalizado)
    .maybeSingle();

  return NextResponse.json({ email: data?.email ?? null });
}
