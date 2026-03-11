// SSE is a long-lived stream — bypass Workbox entirely, use native fetch
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/sse/')) {
    event.respondWith(fetch(event.request));
  }
});
