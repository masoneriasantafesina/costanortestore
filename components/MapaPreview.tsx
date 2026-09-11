'use client';

import { extraerCoordenadas } from '@/lib/mapa';

export default function MapaPreview({ mapsUrl }: { mapsUrl: string | null | undefined }) {
  const coords = extraerCoordenadas(mapsUrl);

  if (!coords) return null;

  return (
    <a
      href={mapsUrl!}
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
