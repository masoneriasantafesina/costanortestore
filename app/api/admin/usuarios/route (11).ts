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

// Dominio interno "falso" para poder usar Supabase Auth (que exige un email)
// sin que el operador necesite tener un email real. Nunca se lo mostramos:
// para él, esto es simplemente su "nombre de usuario".
const DOMINIO_INTERNO = 'costanortestore.local';

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

  const { nombre, telefono, nombreUsuario, password, rol } = await req.json();

  if (!nombre || !nombreUsuario || !password || !rol) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña tiene que tener al menos 6 caracteres' }, { status: 400 });
  }

  const nombreUsuarioNormalizado = String(nombreUsuario).trim().toLowerCase().replace(/\s+/g, '');
  if (!/^[a-z0-9._-]{3,30}$/.test(nombreUsuarioNormalizado)) {
    return NextResponse.json(
      { error: 'El nombre de usuario tiene que tener entre 3 y 30 caracteres, sin espacios ni símbolos raros' },
      { status: 400 }
    );
  }

  const { data: existente } = await supabaseAdmin
    .from('perfiles')
    .select('id')
    .eq('nombre_usuario', nombreUsuarioNormalizado)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 400 });
  }

  const emailInterno = `${nombreUsuarioNormalizado}@${DOMINIO_INTERNO}`;

  const { data: creado, error: errorCrear } = await supabaseAdmin.auth.admin.createUser({
    email: emailInterno,
    password,
    email_confirm: true,
  });

  if (errorCrear || !creado?.user) {
    return NextResponse.json({ error: errorCrear?.message ?? 'No se pudo crear el usuario' }, { status: 500 });
  }

  const { error: errorPerfil } = await supabaseAdmin.from('perfiles').insert({
    id: creado.user.id,
    email: emailInterno,
    nombre,
    telefono: telefono || null,
    nombre_usuario: nombreUsuarioNormalizado,
    rol,
  });

  if (errorPerfil) {
    // Si falló guardar el perfil, no dejamos un usuario de Auth huérfano
    // sin fila en perfiles (quedaría sin poder loguearse con sentido).
    await supabaseAdmin.auth.admin.deleteUser(creado.user.id);
    return NextResponse.json({ error: errorPerfil.message }, { status: 500 });
  }

  await supabaseAdmin.from('log_auditoria').insert({
    usuario_id: admin.id,
    usuario_email: admin.email,
    accion: 'crear_usuario',
    entidad: 'usuario',
    entidad_id: creado.user.id,
    detalle: `Usuario "${nombreUsuarioNormalizado}" (${nombre}) creado con rol "${rol}"`,
  });

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
