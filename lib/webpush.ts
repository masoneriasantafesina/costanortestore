import { createPrivateKey, sign } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Envío de notificaciones push (Web Push) sin librerías externas.
// Se manda un aviso "vacío" firmado con las claves VAPID; el service worker
// (public/sw.js) es el que muestra el cartel en el celular.

function aBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(s: string): Buffer {
  const relleno = '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from((s + relleno).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function pushConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function firmarVapid(endpoint: string, clavePublica: string, clavePrivada: string, asunto: string): string {
  const audiencia = new URL(endpoint).origin;
  const cabecera = aBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = aBase64Url(
    Buffer.from(
      JSON.stringify({ aud: audiencia, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: asunto })
    )
  );
  const pub = deBase64Url(clavePublica); // 65 bytes: 0x04 + X (32) + Y (32)
  const llave = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: clavePrivada,
      x: aBase64Url(pub.subarray(1, 33)),
      y: aBase64Url(pub.subarray(33, 65)),
    },
    format: 'jwk',
  });
  const firma = sign('sha256', Buffer.from(`${cabecera}.${cuerpo}`), { key: llave, dsaEncoding: 'ieee-p1363' });
  return `${cabecera}.${cuerpo}.${aBase64Url(firma)}`;
}

export type ResultadoPush = 'ok' | 'expirada' | 'error';

export async function enviarPush(endpoint: string): Promise<ResultadoPush> {
  const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const clavePrivada = process.env.VAPID_PRIVATE_KEY;
  if (!clavePublica || !clavePrivada) return 'error';
  const asunto = process.env.VAPID_SUBJECT || 'https://costanortestore.vercel.app';
  try {
    const jwt = firmarVapid(endpoint, clavePublica, clavePrivada, asunto);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${clavePublica}`,
        TTL: '86400',
        Urgency: 'high',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status >= 200 && res.status < 300) return 'ok';
    if (res.status === 404 || res.status === 410) return 'expirada';
    console.error('Push rechazado', res.status, await res.text().catch(() => ''));
    return 'error';
  } catch (e) {
    console.error('Push falló', (e as Error).message);
    return 'error';
  }
}

// Avisa a todos los dispositivos suscriptos (o solo a los de un usuario).
// Borra las suscripciones que ya no existen (app desinstalada, permiso revocado).
export async function notificarSuscriptos(
  supabase: SupabaseClient,
  soloUsuarioId?: string
): Promise<{ enviados: number; fallidos: number; total: number }> {
  if (!pushConfigurado()) return { enviados: 0, fallidos: 0, total: 0 };
  let consulta = supabase.from('push_suscripciones').select('id, endpoint');
  if (soloUsuarioId) consulta = consulta.eq('usuario_id', soloUsuarioId);
  const { data } = await consulta;
  const suscripciones = (data ?? []) as { id: string; endpoint: string }[];
  const resultados = await Promise.all(suscripciones.map((s) => enviarPush(s.endpoint)));
  const vencidas = suscripciones.filter((_, i) => resultados[i] === 'expirada').map((s) => s.id);
  if (vencidas.length > 0) {
    await supabase.from('push_suscripciones').delete().in('id', vencidas);
  }
  const enviados = resultados.filter((r) => r === 'ok').length;
  return { enviados, fallidos: resultados.length - enviados, total: resultados.length };
}
