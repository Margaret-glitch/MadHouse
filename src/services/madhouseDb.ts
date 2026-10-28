/**
 * MadHouse Database Service
 * Provides document storage in the worker database (userData folder)
 */

import { VideoItem } from '../types';

export const BASE_DB = 'https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db';

/**
 * Helper to ensure path starts cleanly and formats for json file storage
 */
function normalizeDocPath(path: string): string {
  let clean = path.replace(/^\/+/, '');
  if (!clean.startsWith('userData/')) {
    clean = `userData/${clean}`;
  }
  return clean;
}

/**
 * 1. Create / Replace Document (PUT /U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/:path)
 */
export async function createDocument<T = any>(path: string, data: T): Promise<any> {
  const targetPath = normalizeDocPath(path);
  const res = await fetch(`${BASE_DB}/${targetPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to save document to ${targetPath}: ${res.status} ${errText}`);
  }

  return res.json().catch(() => ({ success: true }));
}

/**
 * 2. Read Document (GET /U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/:path)
 */
export async function readDocument<T = any>(path: string): Promise<T | null> {
  const targetPath = normalizeDocPath(path);
  
  // Try reading directly, fallback to .json if not included
  let res = await fetch(`${BASE_DB}/${targetPath}`);
  if (!res.ok && !targetPath.endsWith('.json')) {
    res = await fetch(`${BASE_DB}/${targetPath}.json`);
  }

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<T>;
}

/**
 * 3. Partial Update (PATCH /U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/:path)
 */
export async function patchDocument<T = any>(path: string, patch: Partial<T>): Promise<any> {
  const targetPath = normalizeDocPath(path);
  const docPath = targetPath.endsWith('.json') ? targetPath : `${targetPath}.json`;

  const res = await fetch(`${BASE_DB}/${docPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to patch document ${docPath}: ${res.status} ${errText}`);
  }

  return res.json().catch(() => ({ success: true }));
}

/**
 * Save user watch history to userData/history or userData/history_${userId}
 */
export async function saveRemoteHistory(history: VideoItem[], userIdentifier?: string | null): Promise<void> {
  try {
    const payload = {
      user: userIdentifier || 'guest',
      updatedAt: new Date().toISOString(),
      count: history.length,
      history: history.slice(0, 50)
    };

    // Save to global watch_history doc
    await createDocument('userData/watch_history', payload);

    // If a specific logged in user exists, also save user-keyed doc
    if (userIdentifier) {
      const sanitized = userIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_');
      await createDocument(`userData/history_${sanitized}`, payload);
    }
  } catch (err) {
    console.warn('Could not sync watch history to remote DB:', err);
  }
}

/**
 * Load user watch history from userData folder
 */
export async function loadRemoteHistory(userIdentifier?: string | null): Promise<VideoItem[] | null> {
  try {
    if (userIdentifier) {
      const sanitized = userIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_');
      const userDoc = await readDocument<{ history: VideoItem[] }>(`userData/history_${sanitized}`);
      if (userDoc && Array.isArray(userDoc.history) && userDoc.history.length > 0) {
        return userDoc.history;
      }
    }

    const doc = await readDocument<{ history: VideoItem[] }>('userData/watch_history');
    if (doc && Array.isArray(doc.history)) {
      return doc.history;
    }
  } catch (err) {
    console.warn('Could not load remote history:', err);
  }
  return null;
}

/**
 * Save user watchlist to userData/watchlist or userData/watchlist_${userId}
 */
export async function saveRemoteWatchlist(watchlist: VideoItem[], userIdentifier?: string | null): Promise<void> {
  try {
    const payload = {
      user: userIdentifier || 'guest',
      updatedAt: new Date().toISOString(),
      count: watchlist.length,
      watchlist
    };

    await createDocument('userData/user_watchlist', payload);

    if (userIdentifier) {
      const sanitized = userIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_');
      await createDocument(`userData/watchlist_${sanitized}`, payload);
    }
  } catch (err) {
    console.warn('Could not sync watchlist to remote DB:', err);
  }
}

/**
 * Load user watchlist from userData folder
 */
export async function loadRemoteWatchlist(userIdentifier?: string | null): Promise<VideoItem[] | null> {
  try {
    if (userIdentifier) {
      const sanitized = userIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_');
      const userDoc = await readDocument<{ watchlist: VideoItem[] }>(`userData/watchlist_${sanitized}`);
      if (userDoc && Array.isArray(userDoc.watchlist) && userDoc.watchlist.length > 0) {
        return userDoc.watchlist;
      }
    }

    const doc = await readDocument<{ watchlist: VideoItem[] }>('userData/user_watchlist');
    if (doc && Array.isArray(doc.watchlist)) {
      return doc.watchlist;
    }
  } catch (err) {
    console.warn('Could not load remote watchlist:', err);
  }
  return null;
}
