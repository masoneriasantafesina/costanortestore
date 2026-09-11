'use client';

import { extraerCoordenadas } from '@/lib/mapa';

export default function MapaPreview({ mapsUrl }: { mapsUrl: string | null | undefined }) {
  const coords = extraerCoordenadas(mapsUrl);

  if (!coords) return null;

  // Si lo que pegó el usuario ya es una URL completa (empieza con http), la
  // respetamos tal cual para abrirla. Si en cambio pegó solo coordenadas
  // sueltas, armamos nosotros la URL completa de Google Maps — si no, el
  // navegador interpreta el texto como una ruta relativa dentro de esta
  // misma web y termina en un 404.
  const urlParaAbrir = mapsUrl!.trim().startsWith('http')
    ? mapsUrl!
    : `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

  return (
    <a
      href={urlParaAbrir}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-card overflow-hidden border border-frost-100 cursor-pointer"
      title="Abrir en Google Maps"
    >
      <iframe
        src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
        className="w-full h-40 pointer-events-none"
        loading="lazy"
      />
    </a>
  );
}
