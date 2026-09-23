import { supabase } from './supabase/client';

export async function registrarLog(
  accion: string,
  entidad: string,
  entidadId: string | null,
  detalle: string
) {
  const { data: sesion } = await supabase.auth.getSession();
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ accion, entidad, entidad_id: entidadId, detalle }),
    });
  } catch {
    // Si el registro del log falla por algún motivo de red, no queremos que
    // eso interrumpa la acción real que el usuario ya completó.
  }
}
