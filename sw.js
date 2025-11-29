const CACHE_NAME = 'tvboard-v2';
const VIDEO_CACHE_NAME = 'tvboard-videos-v1';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/firebase-config.js',
  '/config-service.js',
  '/messages-service.js',
  '/manifest.json'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js'
];

// Install Event: Cache Core Assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  self.skipWaiting(); // Activate immediately

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Cache core assets (critical)
      try {
        await cache.addAll(CORE_ASSETS);
        console.log('[SW] Core assets cached');
      } catch (error) {
        console.error('[SW] Failed to cache core assets:', error);
      }

      // Cache CDN assets (non-critical, best effort)
      // We use Promise.allSettled to ensure one failure doesn't stop others
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
            throw new Error(`Failed to fetch ${url}`);
          })
        )
      );
      console.log('[SW] CDN assets caching attempt finished');
    })()
  );
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== VIDEO_CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if request is for a video
function isVideoRequest(request) {
  return request.destination === 'video' || request.url.match(/\.(mp4|webm|ogg|mov)$/i);
}

// Helper: Handle Range Requests for Videos
async function handleRangeRequest(event) {
  const request = event.request;
  const cache = await caches.open(VIDEO_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const range = request.headers.get('range');
    const blob = await cachedResponse.blob();

    console.log(`[SW] Cache hit for ${request.url}`);
    console.log(`[SW] Blob size: ${blob.size}, Type: ${blob.type}`);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : blob.size - 1;
      const chunksize = (end - start) + 1;

      const slicedBlob = blob.slice(start, end + 1);

      console.log(`[SW] Serving range ${start}-${end}/${blob.size} (chunk: ${chunksize})`);

      return new Response(slicedBlob, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Range': `bytes ${start}-${end}/${blob.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/mp4'
        }
      });
    } else {
      return cachedResponse;
    }
  }

  // Cache Miss: Serve from network immediately, cache in background

  // 1. Start background cache of full file
  const cachingPromise = (async () => {
    try {
      const fullRequest = new Request(request.url);
      const networkResponse = await fetch(fullRequest);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse);
        console.log('[SW] Video cached in background:', request.url);
      }
    } catch (error) {
      console.error('[SW] Background cache failed:', error);
    }
  })();

  // Keep SW alive until caching finishes
  event.waitUntil(cachingPromise);

  // 2. Return network response to user immediately (pass-through)
  return fetch(request);
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Handle Video Requests (Range Support)
  if (isVideoRequest(request)) {
    event.respondWith(handleRangeRequest(event));
    return;
  }

  // 2. Handle config files (Network First with 5s timeout)
  const configFiles = ['/config.json', '/firebase-config.js', '/config.js'];
  const isConfigFile = configFiles.some(file => request.url.includes(file));

  if (isConfigFile) {
    event.respondWith(
      (async () => {
        try {
          // Race network fetch against 5-second timeout
          const networkPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 5000)
          );

          const networkResponse = await Promise.race([networkPromise, timeoutPromise]);

          // Cache the fresh config
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            console.log('[SW] Updated config.json from network');
          }

          return networkResponse;
        } catch (error) {
          // Network failed or timed out - fall back to cache
          console.log('[SW] Network failed/timeout for config.json, using cache:', error.message);
          const cachedResponse = await caches.match(request);

          if (cachedResponse) {
            return cachedResponse;
          }

          // No cache available
          return new Response('Config unavailable', { status: 503 });
        }
      })()
    );
    return;
  }

  // 3. Handle Core Assets (Cache First)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // 4. Network Fallback
      return fetch(request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // 5. Offline Fallback for Navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Message Event: Handle commands from the client
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'PING':
      if (event.ports[0]) {
        event.ports[0].postMessage({ success: true, message: 'Pong!' });
      }
      break;

    case 'GET_VIDEO_CACHE_STATUS':
      if (event.ports[0]) {
        caches.open(VIDEO_CACHE_NAME).then(cache => {
          cache.keys().then(keys => {
            event.ports[0].postMessage({
              success: true,
              count: keys.length,
              cachedVideos: keys.map(k => k.url)
            });
          });
        });
      }
      break;

    case 'CLEANUP_VIDEO_CACHE':
    case 'CLEAR_VIDEO_CACHE':
      if (event.ports[0]) {
        caches.delete(VIDEO_CACHE_NAME).then(() => {
          event.ports[0].postMessage({ success: true });
        });
      }
      break;

    case 'CLAIM_CLIENTS':
      self.clients.claim();
      if (event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;
  }
});
