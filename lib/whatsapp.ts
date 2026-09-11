export function linkWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;

  let digitos = telefono.replace(/\D/g, '');
  if (!digitos) return null;

  if (digitos.startsWith('54')) {
    // Ya viene con código de país
  } else {
    // Sacamos un 0 inicial (característica local) y un "15" que suele
    // usarse en Argentina para celulares en números escritos a la vieja
    // usanza (ej: 0351 15-4123456).
    digitos = digitos.replace(/^0/, '');
    digitos = digitos.replace(/^(\d{2,4})15/, '$1');
    digitos = `549${digitos}`;
  }

  return `https://wa.me/${digitos}`;
}
