'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function claveParaNavegador(base64: string): BufferSource {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const salida = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) salida[i] = crudo.charCodeAt(i);
  return salida;
}

async function llamarApi(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  let datos: any = {};
  try {
    datos = await res.json();
  } catch {
    datos = {};
  }
  return { ok: res.ok, datos };
}

export default function NotificacionesPedidos() {
  const [estado, setEstado] = useState<'cargando' | 'no_soportado' | 'instalar_ios' | 'sin_claves' | 'listo'>('cargando');
  const [activo, setActivo] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function revisar() {
      const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada =
        (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
      const soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!soportado) {
        setEstado(esIOS && !instalada ? 'instalar_ios' : 'no_soportado');
        return;
      }
      if (!CLAVE_PUBLICA) {
        setEstado('sin_claves');
        return;
      }
      setBloqueado(Notification.permission === 'denied');
      try {
        const registro = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = await registro?.pushManager.getSubscription();
        setActivo(Boolean(sub) && Notification.permission === 'granted');
      } catch {
        setActivo(false);
      }
      setEstado('listo');
    }
    revisar();
  }, []);

  async function activar() {
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setBloqueado(permiso === 'denied');
        setError('No diste permiso para mostrar notificaciones.');
        setTrabajando(false);
        return;
      }
      await navigator.serviceWorker.register('/sw.js');
      const registro = await navigator.serviceWorker.ready;
      let sub = await registro.pushManager.getSubscription();
      if (!sub) {
        sub = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: claveParaNavegador(CLAVE_PUBLICA),
        });
      }
      const { ok, datos } = await llamarApi({ accion: 'suscribir', suscripcion: sub.toJSON() });
      if (!ok) throw new Error(datos.error ?? 'No se pudo guardar la suscripción');
      setActivo(true);
      setMensaje('Listo: este dispositivo va a recibir un aviso cada vez que entre un pedido nuevo.');
    } catch (e) {
      setError('No se pudieron activar las notificaciones: ' + (e as Error).message);
    }
    setTrabajando(false);
  }

  async function desactivar() {
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const registro = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await registro?.pushManager.getSubscription();
      if (sub) {
        await llamarApi({ accion: 'desuscribir', endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setActivo(false);
      setMensaje('Notificaciones desactivadas en este dispositivo.');
    } catch (e) {
      setError('No se pudieron desactivar: ' + (e as Error).message);
    }
    setTrabajando(false);
  }

  async function probar() {
    setTrabajando(true);
    setError('');
    setMensaje('');
    const { ok, datos } = await llamarApi({ accion: 'prueba' });
    if (!ok) {
      setError(datos.error ?? 'No se pudo enviar la prueba.');
    } else if (datos.total === 0) {
      setError('No hay dispositivos suscriptos.');
    } else if (datos.enviados === 0) {
      setError('El aviso no pudo enviarse. Probá desactivar y volver a activar las notificaciones.');
    } else {
      setMensaje(`Prueba enviada a ${datos.enviados} dispositivo(s). Tendría que llegar en unos segundos.`);
    }
    setTrabajando(false);
  }

  return (
    <div className="bg-white rounded-card border border-frost-100 p-5 mt-5">
      <h2 className="font-display text-lg text-frost-800 mb-1">Notificaciones de pedidos nuevos</h2>
      <p className="text-xs text-frost-500 mb-3">
        Si las activás, este dispositivo recibe un aviso cada vez que un cliente hace un pedido desde el catálogo.
        Cada dispositivo (celular, computadora) se activa por separado.
      </p>

      {estado === 'cargando' && <p className="text-sm text-frost-400">Revisando...</p>}
      {estado === 'no_soportado' && (
        <p className="text-sm text-frost-500">Este navegador no permite notificaciones. Probá desde Chrome o desde la app instalada.</p>
      )}
      {estado === 'instalar_ios' && (
        <p className="text-sm text-frost-600">
          En iPhone, las notificaciones solo funcionan con la app instalada: tocá el botón Compartir de Safari →
          “Agregar a pantalla de inicio”, abrí la app desde ese ícono y activalas desde acá.
        </p>
      )}
      {estado === 'sin_claves' && (
        <p className="text-sm text-amber-700">
          Falta terminar la configuración en Vercel (claves de notificaciones). Todavía no se pueden activar.
        </p>
      )}

      {estado === 'listo' && (
        <>
          {bloqueado && (
            <p className="text-sm text-amber-700 mb-3">
              Las notificaciones están bloqueadas para esta app. Habilitalas desde los ajustes del celular o del
              navegador y volvé a intentar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!activo ? (
              <button onClick={activar} disabled={trabajando || bloqueado} className="btn-primary text-sm">
                {trabajando ? 'Activando...' : 'Activar en este dispositivo'}
              </button>
            ) : (
              <>
                <button onClick={probar} disabled={trabajando} className="btn-secondary text-sm">
                  Enviar notificación de prueba
                </button>
                <button
                  onClick={desactivar}
                  disabled={trabajando}
                  className="text-sm font-medium text-red-600 border border-red-200 rounded-card px-3 py-2 hover:bg-red-50"
                >
                  Desactivar
                </button>
              </>
            )}
          </div>
          {activo && <p className="text-xs text-green-700 mt-2">Activadas en este dispositivo.</p>}
        </>
      )}

      {mensaje && <p className="text-sm text-green-700 mt-3">{mensaje}</p>}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
