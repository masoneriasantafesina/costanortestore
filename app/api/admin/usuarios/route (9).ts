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

async function administradorQueLlama(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;

  // La verificación de rol se hace acá, con la service role key, sin
  // depender de RLS: así esta ruta rechaza a cualquiera que no sea
  // administrador aunque llame directo a la API, sin pasar por la pantalla.
  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('rol')
    .eq('id', data.user.id)
    .single();

  if (perfil?.rol !== 'administrador') return null;

  return data.user;
}

export async function POST(req: Request) {
  const admin = await administradorQueLlama(req);
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { email, nombre, rol } = await req.json();
  if (!email || !rol) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const { data: invitado, error: errorInvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/aceptar-invitacion`,
  });

  if (errorInvite || !invitado?.user) {
    return NextResponse.json(
      { error: errorInvite?.message ?? 'No se pudo invitar al usuario' },
      { status: 500 }
    );
  }

  const { error: errorPerfil } = await supabaseAdmin.from('perfiles').insert({
    id: invitado.user.id,
    email,
    nombre: nombre || null,
    rol,
  });

  if (errorPerfil) {
    return NextResponse.json({ error: errorPerfil.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await administradorQueLlama(req);
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  }

  await supabaseAdmin.from('perfiles').delete().eq('id', id);
  await supabaseAdmin.auth.admin.deleteUser(id);

  return NextResponse.json({ ok: true });
}
