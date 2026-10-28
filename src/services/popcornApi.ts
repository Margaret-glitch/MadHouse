/**
 * Popcorn Movie & Series API Client (popcorn.levity.click)
 */

export const POPCORN_BASE_URL = 'https://popcorn.levity.click';
export const POPCORN_API_BASE = `${POPCORN_BASE_URL}/api`;

/**
 * Prefers Original / English versions over dubbed ones.
 * Works on both search results and detail-enriched items.
 */
export function preferOriginal(items: any[] = []) {
  if (!Array.isArray(items) || items.length === 0) return [];

  // 1. Quick title-based filter (works on search results)
  const isDubbedTitle = (title = '') => {
    const t = title.toLowerCase();
    return (
      t.includes('[hindi]') ||
      t.includes('[tamil]') ||
      t.includes('[telugu]') ||
      t.includes('[malayalam]') ||
      t.includes('[kannada]') ||
      t.includes('[bengali]') ||
      t.includes('[marathi]') ||
      t.includes('[ptbr]') ||
      t.includes('[portuguese]') ||
      t.includes('hindi dub') ||
      t.includes('tamil dub')
    );
  };

  // Prefer items that do NOT look dubbed
  const originals = items.filter(item => !isDubbedTitle(item.title));
  if (originals.length > 0) return originals;

  // Fallback: return everything if nothing looked original
  return items;
}

/**
 * Even better version — use when you have the detail.languages array
 */
export function pickBestLanguageVersion(detail: any) {
  if (!detail) return null;

  const langs = detail.languages || [];
  if (langs.length === 0) return detail;

  // Priority order
  const priority = [
    'original audio',
    'original',
    'english',
    'en',
  ];

  for (const p of priority) {
    const match = langs.find((l: any) => 
      (l.name || '').toLowerCase().includes(p)
    );
    if (match?.subjectId) {
      return {
        ...detail,
        preferredSubjectId: match.subjectId,
        preferredLanguage: match.name
      };
    }
  }

  // If nothing matched, just return the current one
  return detail;
}

export interface PopcornTrendingItem {
  id: string;
  subjectId: string;
  title: string;
  cover: string;
  poster: string;
  score?: string;
  releaseTime?: string;
  subjectType: number; // 1 = Movie, 2 = Series
  badgeTag?: string; // "Ep: 8" or "S1-2"
  description?: string;
}

export interface PopcornFeedItem {
  id: string;
  url: string;
  title: string;
  poster: string;
  badgeTag?: string;
}

// In-memory cache for season/episode tags to keep carousel snappy
const seriesTagCache = new Map<string, string>();

/**
 * Fetch episode / season information for a series and format the tag:
 * Multi-season => "S1-N"
 * Single-season => "Ep: N"
 */
export async function getSeriesTag(subjectId: string): Promise<string> {
  if (seriesTagCache.has(subjectId)) {
    return seriesTagCache.get(subjectId)!;
  }

  try {
    const res = await fetch(`${POPCORN_API_BASE}/episodes/${subjectId}`);
    if (!res.ok) throw new Error('Episode fetch failed');
    const json = await res.json();
    const seasons = json?.data?.seasons || [];

    let tag = '';
    if (seasons.length > 1) {
      tag = `S1-${seasons.length}`;
    } else if (seasons.length === 1) {
      const epCount = seasons[0]?.episodes?.length || 8;
      tag = `Ep: ${epCount}`;
    } else {
      tag = 'Series';
    }

    seriesTagCache.set(subjectId, tag);
    return tag;
  } catch {
    const fallback = 'Series';
    seriesTagCache.set(subjectId, fallback);
    return fallback;
  }
}

/**
 * Fetch and filter trending titles from popcorn.levity.click
 */
export async function getPopcornTrending(): Promise<PopcornTrendingItem[]> {
  try {
    const res = await fetch(`${POPCORN_API_BASE}/trending`);
    if (!res.ok) throw new Error('Failed to fetch trending');
    const json = await res.json();
    const rawItems = json?.data || [];

    // Filter using requested preferOriginal
    const filtered = preferOriginal(rawItems);

    // Resolve episode tags for series
    const enriched = await Promise.all(
      filtered.map(async (item: any) => {
        let badgeTag = '';
        if (item.subjectType === 2) {
          badgeTag = await getSeriesTag(item.subjectId || item.id);
        }
        return {
          id: String(item.subjectId || item.id),
          subjectId: String(item.subjectId || item.id),
          title: (item.title || '').replace(/\[.*?\]/g, '').trim(),
          cover: item.cover || item.poster || '',
          poster: item.poster || item.cover || '',
          score: item.score || '',
          releaseTime: item.releaseTime || '',
          subjectType: item.subjectType || 1,
          badgeTag,
          description: item.description || ''
        };
      })
    );

    return enriched;
  } catch (err) {
    console.warn('Popcorn trending fetch fallback:', err);
    return [];
  }
}

/**
 * Fetch latest releases or specific genre from popcorn.levity.click
 */
export async function getPopcornFeed(category = 'latest', page = 1): Promise<PopcornFeedItem[]> {
  try {
    const cleanCat = category.toLowerCase().trim();
    let endpoint = '';

    if (cleanCat === 'all' || cleanCat === 'latest') {
      endpoint = `${POPCORN_API_BASE}/feed/latest?page=${page}`;
    } else {
      const slug = cleanCat === 'tv series' ? 'tv-series' : cleanCat;
      endpoint = `${POPCORN_API_BASE}/feed/category/${slug}?page=${page}`;
    }

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
    const data = await res.json();
    const rawResults = data?.results || [];

    const filtered = preferOriginal(rawResults);

    return filtered.map((item: any) => {
      const rawTitle = item.title || '';
      let badgeTag = '';
      const epMatch = rawTitle.match(/Episode\s*(\d+)/i);
      const sMatch = rawTitle.match(/S(\d+)/i);
      if (epMatch) {
        badgeTag = `Ep: ${epMatch[1]}`;
      } else if (sMatch) {
        badgeTag = `S${parseInt(sMatch[1], 10)}`;
      }

      const cleanTitle = rawTitle
        .replace(/^DOWNLOAD\s+/i, '')
        .replace(/\(Episode.*?\)/i, '')
        .replace(/\[.*?\]/g, '')
        .trim();

      const posterUrl = item.poster?.startsWith('/')
        ? `${POPCORN_BASE_URL}${item.poster}`
        : item.poster;

      return {
        id: item.url || item.title,
        url: item.url,
        title: cleanTitle,
        poster: posterUrl,
        badgeTag
      };
    });
  } catch (err) {
    console.warn(`Popcorn feed fetch error for category ${category}:`, err);
    return [];
  }
}

/**
 * Fetch full detail for a Popcorn Movie/Series by ID
 */
export async function getPopcornDetail(subjectId: string): Promise<PopcornTrendingItem | null> {
  try {
    const res = await fetch(`${POPCORN_API_BASE}/detail/${subjectId}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data || {};
    
    let badgeTag = '';
    if (data.subjectType === 2) {
      badgeTag = await getSeriesTag(subjectId);
    }

    return {
      id: String(subjectId),
      subjectId: String(subjectId),
      title: (data.title || '').replace(/\[.*?\]/g, '').trim(),
      cover: data.cover || data.poster || '',
      poster: data.poster || data.cover || '',
      score: data.score || '',
      releaseTime: data.releaseTime || '',
      subjectType: data.subjectType || 1,
      badgeTag: badgeTag || (data.runtime ? `${data.runtime} min` : 'Movie'),
      description: data.description || ''
    };
  } catch {
    return null;
  }
}

/**
 * Popcorn API search endpoint (POST /api/search)
 */
export async function searchPopcorn(query: string, page = 1): Promise<PopcornFeedItem[]> {
  try {
    const res = await fetch(`${POPCORN_API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, page })
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();
    const results = data?.results || [];

    const filtered = preferOriginal(results);

    return filtered.map((item: any) => {
      const rawTitle = item.title || '';
      let badgeTag = '';
      const epMatch = rawTitle.match(/Episode\s*(\d+)/i);
      const sMatch = rawTitle.match(/S(\d+)/i);
      if (epMatch) {
        badgeTag = `Ep: ${epMatch[1]}`;
      } else if (sMatch) {
        badgeTag = `S${parseInt(sMatch[1], 10)}`;
      }

      const cleanTitle = rawTitle
        .replace(/^DOWNLOAD\s+/i, '')
        .replace(/\(Episode.*?\)/i, '')
        .replace(/\[.*?\]/g, '')
        .trim();

      const posterUrl = item.poster?.startsWith('/')
        ? `${POPCORN_BASE_URL}${item.poster}`
        : item.poster;

      return {
        id: item.url || item.title,
        url: item.url,
        title: cleanTitle,
        poster: posterUrl,
        badgeTag
      };
    });
  } catch (err) {
    console.warn('Popcorn search error:', err);
    return [];
  }
}

/**
 * Fetch Wednesday series for Hero Banner using real search payload for consistency
 */
export async function getWednesdayHero(): Promise<PopcornFeedItem | null> {
  try {
    // 1. Search for 'wednesday' to get the actual payload used in search/feed
    const results = await searchPopcorn('wednesday');
    if (results && results.length > 0) {
      // 2. Return the first result exactly as search provides it
      return results[0];
    }
  } catch (err) {
    console.warn('Wednesday search-based fetch failed:', err);
  }

  // Final fallback (using a likely valid search URL path if search fails)
  return {
    id: '/api/url/aHR0cHM6Ly93d3cud2F0Y2hzdG8ubmV0L3R2LXNlcmllcy93ZWRuZXNkYXktNzk1MDYv',
    url: '/api/url/aHR0cHM6Ly93d3cud2F0Y2hzdG8ubmV0L3R2LXNlcmllcy93ZWRuZXNkYXktNzk1MDYv',
    title: 'Wednesday',
    poster: 'https://pbcdn.aoneroom.com/image/2026/10/26/afcb080f432b1ca8bd79d3380d37effb.jpg',
    badgeTag: 'S1-2'
  };
}
