/**
 * High-Speed IndexedDB Media Cache (Audio & Video)
 */

const DB_NAME = 'popcorn_media_v3_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedMedia(cacheKey: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(URL.createObjectURL(req.result.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Robust media downloader with progress
 */
export async function cacheMedia(
  cacheKey: string,
  url: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!url) return '';

  const existingUrl = await getCachedMedia(cacheKey);
  if (existingUrl) {
    onProgress?.(100);
    return existingUrl;
  }

  try {
    onProgress?.(2);
    // Use high-priority fetch for caching
    const response = await fetch(url, { priority: 'high' } as any);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body?.getReader();
    
    if (!reader) {
      const blob = await response.blob();
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ cacheKey, blob, timestamp: Date.now() });
      onProgress?.(100);
      return URL.createObjectURL(blob);
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        if (totalBytes > 0) {
          const pct = Math.round((receivedBytes / totalBytes) * 100);
          onProgress?.(Math.min(99, pct));
        }
      }
    }

    const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') || 'video/mp4' });
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ cacheKey, blob, timestamp: Date.now() });

    onProgress?.(100);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Media pre-cache failed:', err);
    onProgress?.(100);
    return url;
  }
}

// Backward compatibility exports
export const cacheAudioTrack = (videoId: string, url: string, onProgress?: (p: number) => void) => 
  cacheMedia(`audio_${videoId}`, url, onProgress);

export const getCachedAudio = (videoId: string) => 
  getCachedMedia(`audio_${videoId}`);
