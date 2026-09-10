'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function SubidaFoto({
  valor,
  onCambiar,
  carpeta,
}: {
  valor: string | null | undefined;
  onCambiar: (url: string) => void;
  carpeta: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo tiene que ser una imagen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 5MB.');
      return;
    }

    setError('');
    setSubiendo(true);
    try {
      const extension = file.name.split('.').pop();
      const nombreArchivo = `${carpeta}/${crypto.randomUUID()}.${extension}`;

      const { error: errorSubida } = await supabase.storage
        .from('fotos')
        .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false });

      if (errorSubida) throw errorSubida;

      const { data } = supabase.storage.from('fotos').getPublicUrl(nombreArchivo);
      onCambiar(data.publicUrl);
    } catch (err: any) {
      setError(err.message ?? 'No se pudo subir la imagen.');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <label className="text-xs font-semibold text-frost-500 uppercase">Foto</label>
      <div className="flex items-center gap-3 mt-1">
        <div className="w-16 h-16 rounded-card bg-frost-50 border border-frost-100 overflow-hidden flex items-center justify-center shrink-0">
          {valor ? (
            <img src={valor} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <span className="text-frost-300 text-[10px] text-center px-1">Sin foto</span>
          )}
        </div>
        <label className="btn-secondary text-sm cursor-pointer">
          {subiendo ? 'Subiendo...' : valor ? 'Cambiar foto' : 'Subir foto'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={manejarArchivo}
            disabled={subiendo}
          />
        </label>
        {valor && !subiendo && (
          <button type="button" onClick={() => onCambiar('')} className="text-xs text-red-600">
            Quitar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
