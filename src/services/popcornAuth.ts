/**
 * MadHouse Authentication & Movie Catalog API Client
 */

import {
  registerMadHouse,
  loginMadHouse,
  logoutMadHouse,
  checkAuthSession,
  MadHouseUser
} from './madhouseAuth';

export const API_BASE = '/api';
export const DIRECT_API_BASE = 'https://popcorn.levity.click/api';

/**
 * Request wrapper for Movie streaming endpoints
 */
export async function request(path: string, options: RequestInit = {}): Promise<any> {
  let url = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  } catch (netErr) {
    url = `${DIRECT_API_BASE}${path}`;
    response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  }

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const errorMsg =
      (data && typeof data === 'object' && (data.detail || data.msg || data.message)) ||
      (typeof data === 'string' ? data : `${response.status} Error`);
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Register account using MadHouse auth worker
 */
export async function register(account: string, password: string, name?: string): Promise<MadHouseUser> {
  return registerMadHouse(account, password, name);
}

/**
 * Login with email and password using MadHouse auth worker
 */
export async function login(account: string, password: string): Promise<MadHouseUser> {
  return loginMadHouse(account, password);
}

/**
 * Fetch current user profile using MadHouse session
 */
export async function currentUser(): Promise<MadHouseUser | null> {
  return checkAuthSession();
}

/**
 * Logout and clear session
 */
export async function logout(): Promise<any> {
  await logoutMadHouse();
  return { status: 'logged_out' };
}

/**
 * Search movies from catalog
 */
export async function searchMovies(query: string): Promise<any> {
  return request(`/search?q=${encodeURIComponent(query)}&page=1`);
}

/**
 * Fetch streaming metadata and links for a title or episode
 */
export async function getStream(
  subjectId: string,
  season: number = 1,
  episode: number = 1,
  quality: string = ''
): Promise<any> {
  const params = new URLSearchParams({
    season: String(season),
    episode: String(episode)
  });
  if (quality) params.set('quality', quality);

  const result = await request(
    `/stream/${encodeURIComponent(subjectId)}?${params}`
  );
  return result;
}

/**
 * Recursive finder for playable video URL in stream response
 */
export function findPlayableUrl(value: any): string | null {
  if (!value || typeof value !== 'object') return null;

  const keys = ['url', 'streamUrl', 'videoUrl', 'downloadUrl', 'playUrl', 'm3u8', 'mp4'];
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return value[key];
    }
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findPlayableUrl(item);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findPlayableUrl(child);
      if (found) return found;
    }
  }
  return null;
}
