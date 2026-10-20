import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Esta ruta la llama Vercel solo, cada pocos días (ver vercel.json), para que
// Supabase vea actividad en la base de datos y no pause el proyecto por inactividad.
// Hace una consulta mínima: no modifica nada y no devuelve datos.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Opcional: si definís la variable CRON_SECRET en Vercel, solo responde a Vercel.
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase.from('productos').select('id').limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fecha: new Date().toISOString() });
}
