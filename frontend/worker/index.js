// SSE must not be intercepted by the SW — streaming responses passed through
// event.respondWith() break EventSource on mobile. The runtimeCaching config
// already excludes /api/sse/ from all Workbox routes, so nothing handles it
// here either, letting the browser connect to SSE natively.
