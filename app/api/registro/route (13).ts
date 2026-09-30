import { NextResponse } from 'next/server';

// El registro público se cerró: ahora las cuentas las crea un administrador
// directamente desde /admin/usuarios. Esta ruta se deja neutralizada en vez
// de borrada, por si en el futuro se necesita reabrir el flujo.
export async function POST() {
  return NextResponse.json(
    { error: 'El registro está cerrado. Pedile a un administrador que te cree una cuenta desde el panel.' },
    { status: 403 }
  );
}
