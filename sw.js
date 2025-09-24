// Service Worker for Digital Bulletin Board PWA
const CACHE_NAME = 'bulletin-board-v9';
const VIDEO_CACHE_NAME = 'bulletin-board-videos-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  'config.js',
  'firebase-config.js',
  'config-service.js',
  'messages-service.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js'
];

// Helper function to check if a request is for a video file
function isVideoRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // Check file extension
  const isVideoExtension = pathname.endsWith('.mp4') ||
                          pathname.endsWith('.webm') ||
                          pathname.endsWith('.ogg') ||
                          pathname.endsWith('.avi') ||
                          pathname.endsWith('.mov');

  // Check request destination
  const isVideoDestination = request.destination === 'video';

  // Check content type if available
  const acceptHeader = request.headers.get('accept') || '';
  const isVideoAccept = acceptHeader.includes('video/');

  const isVideo = isVideoExtension || isVideoDestination || isVideoAccept;

  // Check if this is a same-origin request or if we should skip CORS-problematic requests
  const currentOrigin = self.location.origin;
  const requestOrigin = url.origin;
  const isSameOrigin = currentOrigin === requestOrigin;

  // Only intercept same-origin video requests or local file requests to avoid CORS issues
  const shouldIntercept = isVideo && (isSameOrigin || url.protocol === 'file:');

  if (isVideo) {
    console.log('Video request detected:', {
      url: request.url,
      extension: isVideoExtension,
      destination: isVideoDestination,
      accept: isVideoAccept,
      sameOrigin: isSameOrigin,
      willIntercept: shouldIntercept
    });
  }

  return shouldIntercept;
}

// Helper function to handle range requests for video streaming
async function handleRangeRequest(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');

  // If no range header, return the full cached response
  if (!rangeHeader || !cachedResponse) {
    console.log('No range header, returning full cached response');
    return cachedResponse;
  }

  try {
    const arrayBuffer = await cachedResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const totalLength = bytes.length;

    console.log('Processing range request:', rangeHeader, 'Total length:', totalLength);

    // Parse range header (e.g., "bytes=0-1023")
    const range = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(range[0], 10) || 0;
    const end = parseInt(range[1], 10) || totalLength - 1;

    if (start >= totalLength || end >= totalLength || start > end) {
      console.log('Invalid range:', start, end, totalLength);
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalLength}`,
          'Accept-Ranges': 'bytes'
        }
      });
    }

    const chunkSize = (end - start) + 1;
    const chunk = bytes.slice(start, end + 1);

    console.log('Serving range:', start, '-', end, '/', totalLength, 'Size:', chunkSize);

    return new Response(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/mp4',
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error) {
    console.error('Error handling range request:', error);
    // Fallback to full response
    return cachedResponse;
  }
}

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service worker installing...');
  // Skip waiting immediately - don't wait for old SW to be unused
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Cache populated successfully, service worker ready');
      })
      .catch(error => {
        console.error('Cache install failed:', error);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Log all requests for debugging
  if (event.request.url.includes('.mp4') || event.request.url.includes('video')) {
    console.log('Fetch event for potential video:', event.request.url, {
      method: event.request.method,
      destination: event.request.destination,
      headers: Object.fromEntries(event.request.headers.entries())
    });
  }

  // Always fetch configuration and app files from network to ensure fresh updates
  if (event.request.url.includes('config.js') ||
      event.request.url.includes('firebase-config.js') ||
      event.request.url.includes('config-service.js') ||
      event.request.url.includes('messages-service.js') ||
      event.request.url.includes('app.js')) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.log('Configuration file fetch failed:', error);
          // Fallback to cached version only if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // Don't cache Firebase API requests
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle video requests with on-demand caching
  if (isVideoRequest(event.request)) {
    console.log('✅ Intercepting video request:', event.request.url);
    event.respondWith(
      handleVideoRequest(event.request)
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(error => {
        console.log('Fetch failed:', error);
        // Return offline page or fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Handle video requests with caching and range support
async function handleVideoRequest(request) {
  try {
    const videoCache = await caches.open(VIDEO_CACHE_NAME);

    // Create a cache key without query parameters for better matching
    const url = new URL(request.url);
    const cacheKey = url.origin + url.pathname;

    // Try to match with both original URL and cache key
    let cachedResponse = await videoCache.match(request.url) || await videoCache.match(cacheKey);

    // If video is cached, handle range requests
    if (cachedResponse) {
      console.log('Serving video from cache:', request.url);
      return await handleRangeRequest(request, cachedResponse);
    }

    // Video not cached, fetch from network with CORS handling
    console.log('Fetching video from network:', request.url);

    // Try different fetch strategies to handle CORS
    let networkResponse;

    try {
      // First try: normal fetch (works if CORS is properly configured)
      networkResponse = await fetch(request);
    } catch (corsError) {
      console.log('Normal fetch failed, trying no-cors mode:', corsError.message);

      try {
        // Second try: no-cors mode (allows fetching but limits what we can do with response)
        networkResponse = await fetch(request.url, {
          mode: 'no-cors',
          credentials: 'omit'
        });
        console.log('No-cors fetch successful');
      } catch (noCorsError) {
        console.log('No-cors fetch also failed:', noCorsError.message);
        throw corsError; // Throw original CORS error
      }
    }

    if (!networkResponse.ok && networkResponse.type !== 'opaque') {
      throw new Error(`Network response not ok: ${networkResponse.status}`);
    }

    // For opaque responses (no-cors), we can still cache them
    if (networkResponse.type === 'opaque' || networkResponse.status === 200 || networkResponse.status === 206) {
      const responseToCache = networkResponse.clone();

      // Cache the video asynchronously (don't wait for it)
      videoCache.put(cacheKey, responseToCache).then(() => {
        console.log('Video cached successfully (type: ' + networkResponse.type + '):', cacheKey);
      }).catch(error => {
        console.error('Failed to cache video:', cacheKey, error);
      });
    }

    return networkResponse;
  } catch (error) {
    console.error('Video request failed:', request.url, error);

    // Try to return cached version as fallback
    const videoCache = await caches.open(VIDEO_CACHE_NAME);
    const url = new URL(request.url);
    const cacheKey = url.origin + url.pathname;

    let cachedResponse = await videoCache.match(request.url) || await videoCache.match(cacheKey);

    if (cachedResponse) {
      console.log('Serving cached video as fallback:', request.url);
      return await handleRangeRequest(request, cachedResponse);
    }

    // If no cache available, let the request pass through to the browser
    // This allows the browser to handle CORS and display appropriate errors
    console.log('No cache available, passing through to browser');
    return fetch(request);
  }
}

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service worker activating...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Keep current main cache and video cache, delete others
            if (cacheName !== CACHE_NAME && cacheName !== VIDEO_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim clients immediately - don't wait for next navigation
      self.clients.claim().then(() => {
        console.log('Service worker now controlling all clients');
      })
    ]).then(() => {
      console.log('Service worker fully activated and controlling all clients');
    })
  );
});

// Video cache management - limit cache size and cleanup old videos
async function manageVideoCache() {
  const videoCache = await caches.open(VIDEO_CACHE_NAME);
  const requests = await videoCache.keys();

  // If we have more than 10 videos cached, remove the oldest ones
  const MAX_CACHED_VIDEOS = 10;

  if (requests.length > MAX_CACHED_VIDEOS) {
    console.log(`Video cache has ${requests.length} items, cleaning up...`);

    // Sort by URL to have a consistent cleanup order (in a real app, you'd want to track access times)
    const sortedRequests = requests.sort((a, b) => a.url.localeCompare(b.url));
    const videosToDelete = sortedRequests.slice(0, requests.length - MAX_CACHED_VIDEOS);

    for (const request of videosToDelete) {
      await videoCache.delete(request);
      console.log('Deleted cached video:', request.url);
    }
  }
}

// Background sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks
      console.log('Background sync triggered')
    );
  } else if (event.tag === 'video-cache-cleanup') {
    event.waitUntil(manageVideoCache());
  }
});

// Message handler for communication with main app
self.addEventListener('message', event => {
  console.log('Service worker received message:', event.data);

  // Automatically claim clients when receiving any message (ensures control)
  self.clients.claim().then(() => {
    console.log('Clients claimed on message receipt');
  }).catch(error => {
    console.error('Failed to claim clients on message:', error);
  });

  if (event.data && event.data.type) {
    const port = event.ports && event.ports[0];

    if (!port) {
      console.error('No message port available');
      return;
    }

    switch (event.data.type) {
      case 'CLEANUP_VIDEO_CACHE':
        console.log('Processing CLEANUP_VIDEO_CACHE request');
        event.waitUntil(
          manageVideoCache().then(() => {
            console.log('Video cache cleanup completed');
            port.postMessage({ success: true });
          }).catch(error => {
            console.error('Video cache cleanup failed:', error);
            port.postMessage({ success: false, error: error.message });
          })
        );
        break;

      case 'GET_VIDEO_CACHE_STATUS':
        console.log('Processing GET_VIDEO_CACHE_STATUS request');
        event.waitUntil(
          (async () => {
            try {
              const videoCache = await caches.open(VIDEO_CACHE_NAME);
              const requests = await videoCache.keys();
              const cachedVideos = requests.map(req => req.url);

              console.log('Video cache status:', { count: cachedVideos.length, videos: cachedVideos });
              port.postMessage({
                success: true,
                cachedVideos: cachedVideos,
                count: cachedVideos.length
              });
            } catch (error) {
              console.error('Failed to get video cache status:', error);
              port.postMessage({ success: false, error: error.message });
            }
          })()
        );
        break;

      case 'CLEAR_VIDEO_CACHE':
        console.log('Processing CLEAR_VIDEO_CACHE request');
        event.waitUntil(
          caches.delete(VIDEO_CACHE_NAME).then(() => {
            console.log('Video cache cleared successfully');
            port.postMessage({ success: true });
          }).catch(error => {
            console.error('Failed to clear video cache:', error);
            port.postMessage({ success: false, error: error.message });
          })
        );
        break;

      case 'PING':
        console.log('Processing PING request');
        port.postMessage({ success: true, message: 'Service worker is active' });
        break;

      case 'SKIP_WAITING':
        console.log('Processing SKIP_WAITING request');
        self.skipWaiting();
        if (port) {
          port.postMessage({ success: true, message: 'Skip waiting called' });
        }
        break;

      case 'CLAIM_CLIENTS':
        console.log('Processing CLAIM_CLIENTS request');
        event.waitUntil(
          self.clients.claim().then(() => {
            console.log('Clients claimed successfully');
            if (port) {
              port.postMessage({ success: true, message: 'Clients claimed' });
            }
          }).catch(error => {
            console.error('Failed to claim clients:', error);
            if (port) {
              port.postMessage({ success: false, error: error.message });
            }
          })
        );
        break;

      default:
        console.warn('Unknown message type:', event.data.type);
        if (port) {
          port.postMessage({ success: false, error: 'Unknown message type' });
        }
    }
  }
});

// Push notifications (for future use)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
