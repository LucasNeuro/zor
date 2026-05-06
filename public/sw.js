// Service worker auto-destruidor — apaga todos os caches antigos e se desregistra.
// Qualquer SW anterior (obra10plus-v1, v2, …) que ainda esteja instalado vai
// ser substituído por este, que imediatamente limpa tudo e força reload.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  // Apaga todos os caches (v1, v2, qualquer nome)
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));

  // Remove este próprio SW do registro
  await self.registration.unregister();

  // Força cada aba/janela a navegar para a própria URL (reload limpo, sem cache)
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.navigate(client.url));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'Obra10+', body: event.data.text() }; }
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/office' },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Obra10+', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/office';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
