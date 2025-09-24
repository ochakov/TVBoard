# Video Caching Implementation

This document describes the on-demand video caching implementation for the Digital Bulletin Board PWA.

## Overview

The service worker now automatically caches video files on demand when they are first requested. This improves performance for subsequent video playback and provides offline capability for previously viewed videos.

## Features

### 1. On-Demand Caching
- Videos are cached automatically when first requested
- No pre-caching of videos to avoid unnecessary storage usage
- Supports multiple video formats: MP4, WebM, OGG, AVI, MOV

### 2. Range Request Support
- Handles HTTP Range requests for video streaming
- Enables seeking within cached videos
- Proper partial content responses (206 status)

### 3. Cache Management
- Automatic cleanup when cache exceeds 10 videos
- Manual cache management through service worker messages
- Separate cache storage for videos (`bulletin-board-videos-v1`)

### 4. Fallback Handling
- Network-first strategy for video requests
- Falls back to cached version if network fails
- Graceful error handling with appropriate HTTP status codes

## Implementation Details

### Service Worker Changes

#### New Cache Constants
```javascript
const VIDEO_CACHE_NAME = 'bulletin-board-videos-v1';
```

#### Video Detection
```javascript
function isVideoRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();
  return pathname.endsWith('.mp4') || 
         pathname.endsWith('.webm') || 
         pathname.endsWith('.ogg') || 
         pathname.endsWith('.avi') || 
         pathname.endsWith('.mov') ||
         request.destination === 'video';
}
```

#### Range Request Handling
The service worker properly handles HTTP Range requests, which are essential for video streaming:
- Parses Range headers (e.g., "bytes=0-1023")
- Returns appropriate 206 Partial Content responses
- Handles invalid ranges with 416 Range Not Satisfiable

### Cache Management API

The service worker exposes several message-based APIs for cache management:

#### Get Cache Status
```javascript
const result = await sendMessageToServiceWorker({ type: 'GET_VIDEO_CACHE_STATUS' });
// Returns: { success: true, cachedVideos: [...], count: number }
```

#### Cleanup Cache
```javascript
const result = await sendMessageToServiceWorker({ type: 'CLEANUP_VIDEO_CACHE' });
// Removes oldest videos if cache exceeds 10 items
```

#### Clear Cache
```javascript
const result = await sendMessageToServiceWorker({ type: 'CLEAR_VIDEO_CACHE' });
// Completely clears the video cache
```

## Usage

### Automatic Caching
Videos are automatically cached when:
1. A video request is made (detected by file extension or request destination)
2. The request is successful (200 status)
3. It's not a range request (full video download)

### Manual Cache Management
The main application now includes helper methods:

```javascript
// Get cache status
const status = await bulletinBoard.getVideoCacheStatus();

// Cleanup old videos
await bulletinBoard.cleanupVideoCache();

// Clear all cached videos
await bulletinBoard.clearVideoCache();
```

## Testing

A test page (`video-cache-test.html`) is provided to verify the caching functionality:

1. Open `video-cache-test.html` in your browser
2. Select a video from the dropdown
3. Play the video (it will be cached)
4. Check the cache status
5. Reload the page and play the same video (should load from cache)

### Console Logging
The service worker provides detailed console logging:
- `Serving video from cache: [URL]` - Video served from cache
- `Fetching video from network: [URL]` - Video fetched from network
- `Video cached successfully: [URL]` - Video successfully cached
- `Video cache has X items, cleaning up...` - Cache cleanup triggered

## Configuration

### Cache Limits
The maximum number of cached videos is set to 10 by default. This can be modified in the service worker:

```javascript
const MAX_CACHED_VIDEOS = 10; // Change this value as needed
```

### Cache Strategy
The implementation uses a "Network First" strategy:
1. Try to fetch from network
2. If successful, cache the response and return it
3. If network fails, serve from cache if available
4. If no cache available, return 404

## CORS Limitations

**Important:** Due to CORS (Cross-Origin Resource Sharing) policies, the service worker can only cache videos from:
- The same origin as your application
- Servers that include proper CORS headers (`Access-Control-Allow-Origin`)

### Current Video URLs Issue
The videos in your config (`https://devisrael.z39.web.core.windows.net/files/mp4/`) are served without CORS headers, which prevents the service worker from caching them.

### Solutions:
1. **Host videos locally** - Place videos in your `files/` directory
2. **Configure CORS** - Add CORS headers to the video server
3. **Use a proxy** - Serve videos through your own server with CORS headers

### Example Local Setup:
```javascript
// In config.js, change from:
videoUrls: [
    'https://devisrael.z39.web.core.windows.net/files/mp4/CalmHeb1.mp4'
]

// To:
videoUrls: [
    'files/videos/CalmHeb1.mp4'  // Local file
]
```

## Browser Compatibility

This implementation requires:
- Service Worker support
- Cache API support
- MessageChannel API support

All modern browsers support these features. The implementation gracefully degrades if service workers are not available.

## Performance Considerations

### Storage Usage
- Videos can be large files (several MB each)
- Cache is limited to 10 videos by default
- Consider storage quotas on mobile devices

### Network Usage
- First request always goes to network
- Subsequent requests served from cache
- Range requests work with cached videos

### Memory Usage
- Range request handling loads entire video into memory temporarily
- Consider this for very large video files
- Browser's built-in video caching may also apply

## Future Enhancements

Potential improvements for the video caching system:

1. **LRU Cache Management**: Track access times and remove least recently used videos
2. **Selective Caching**: Allow configuration of which videos to cache
3. **Cache Preloading**: Option to preload specific videos
4. **Storage Quota Management**: Monitor and respect browser storage quotas
5. **Compression**: Implement video compression for cached files
6. **Cache Sharing**: Share cached videos across multiple PWA instances

## Troubleshooting

### Videos Not Caching
- Check browser console for service worker errors
- Verify service worker is registered and active
- Ensure video URLs are accessible
- Check if storage quota is exceeded

### Range Requests Not Working
- Verify the video server supports Range requests
- Check if cached response includes proper headers
- Test with different video formats

### Cache Not Clearing
- Check service worker message handling
- Verify MessageChannel communication
- Try manual cache deletion through DevTools
