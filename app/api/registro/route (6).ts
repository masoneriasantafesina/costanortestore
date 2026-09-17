import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { email, nombre, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña tiene que tener al menos 6 caracteres' }, { status: 400 });
  }

  // Se crea ya confirmado del lado del servidor: no se envía ningún email,
  // así que esto no consume el límite de correos de Supabase.
  const { data: creado, error: errorCrear } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorCrear || !creado?.user) {
    return NextResponse.json(
      { error: errorCrear?.message ?? 'No se pudo crear el usuario' },
      { status: 500 }
    );
  }

  // Todo autoregistro entra como "Nuevo", sin acceso a nada del sistema
  // salvo cambiar su propia contraseña. El admin lo aprueba a mano desde
  // la pantalla de Usuarios, eligiéndole un rol real.
  const { error: errorPerfil } = await supabaseAdmin.from('perfiles').insert({
    id: creado.user.id,
    email,
    nombre: nombre || null,
    rol: 'nuevo',
  });

  if (errorPerfil) {
    return NextResponse.json({ error: errorPerfil.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
