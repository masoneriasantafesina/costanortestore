// Service worker de Tild@: solo muestra las notificaciones de pedidos nuevos.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Tild@ · Nuevo pedido', {
      body: 'Entró un pedido nuevo desde el catálogo. Tocá para verlo.',
      icon: '/brand/tilda-icon-192.png',
      badge: '/brand/tilda-favicon-32.png',
      tag: 'pedido-nuevo',
      renotify: true,
      data: { url: '/admin/pedidos' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/admin/pedidos';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.focus();
          if ('navigate' in v) v.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
