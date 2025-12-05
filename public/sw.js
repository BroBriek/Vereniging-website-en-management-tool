self.addEventListener('push', function(event) {
  let data = { title: 'Chiro Leiding', body: 'Nieuw bericht in het leidingshoekje!' };
  
  if (event.data) {
    try {
        const payload = event.data.json();
        if (payload.title) data.title = payload.title;
        if (payload.body) data.body = payload.body;
    } catch(e) {
        data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/img/Hero.jpg', // Using existing image as icon
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/feed')
  );
});