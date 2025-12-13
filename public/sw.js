self.addEventListener('push', function(event) {
  let data = { title: 'Chiro Leiding', body: 'Nieuw bericht in het leidingshoekje!', url: '/feed' };
  
  if (event.data) {
    try {
        const payload = event.data.json();
        if (payload.title) data.title = payload.title;
        if (payload.body) data.body = payload.body;
        if (payload.url) data.url = payload.url;
    } catch(e) {
        data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'favicon.jpg', // Using existing image as icon
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/feed';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
