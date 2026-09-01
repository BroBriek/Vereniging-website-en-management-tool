// Service Worker for Chiro Vreugdeland
// NOTE: If adding a 'fetch' event handler in the future, ensure it ignores media/download URLs
// to avoid hitting the 50MB PWA storage limit on iOS, which can "brick" the app's offline features.

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
  var urlToOpen = event.notification.data.url || '/feed';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Resolve relative URL to absolute for proper comparison with client.url
      var absoluteUrl = new URL(urlToOpen, self.location.origin).href;

      // 1. Try to find an existing tab already on the target URL and focus it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // 2. Try to navigate an existing same-origin tab to the URL (avoids piling up tabs on mobile)
      for (var j = 0; j < clientList.length; j++) {
        var existingClient = clientList[j];
        if (existingClient.url.startsWith(self.location.origin) && 'navigate' in existingClient) {
          return existingClient.navigate(absoluteUrl).then(function(c) { return c.focus(); });
        }
      }

      // 3. No existing tab found – open a new window
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
