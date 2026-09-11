export function extraerCoordenadas(mapsUrl: string | null | undefined): { lat: number; lng: number } | null {
  if (!mapsUrl) return null;

  // Link típico compartido desde Google Maps: .../@-31.4201,-64.1888,17z/...
  const patronArroba = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (patronArroba) {
    return { lat: parseFloat(patronArroba[1]), lng: parseFloat(patronArroba[2]) };
  }

  // Link con parámetro de búsqueda: ...?q=-31.4201,-64.1888
  const patronQuery = mapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (patronQuery) {
    return { lat: parseFloat(patronQuery[1]), lng: parseFloat(patronQuery[2]) };
  }

  // Coordenadas pegadas directamente como texto: "-31.4201, -64.1888"
  const patronDirecto = mapsUrl.trim().match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (patronDirecto) {
    return { lat: parseFloat(patronDirecto[1]), lng: parseFloat(patronDirecto[2]) };
  }

  return null;
}
