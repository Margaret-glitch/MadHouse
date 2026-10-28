/**
 * Utility to clean movie and series titles for display in headers and banners.
 * Removes clutter like (S2), S2, (Complete), (S1-2), [Hindi Dub], etc.
 */
export function cleanMovieTitle(title: string = ''): string {
  if (!title) return '';

  return title
    .replace(/\s*\(?\s*S\d+.*?\)?/gi, '') // Removes (S2), S2, (S1-2), S1-2
    .replace(/\s*\(?\s*Complete.*?\)?/gi, '') // Removes (Complete...), (Complete)
    .replace(/\s*\[.*?\]/g, '') // Removes [anything]
    .replace(/\s*\(.*?\)/g, (match) => {
      // If parenthetical contains season, ep, complete, hindi, dub, etc., strip it
      if (/(s\d+|complete|ep|season|hindi|dub|multi|dual|720p|1080p|hd)/i.test(match)) {
        return '';
      }
      return match;
    })
    .replace(/\s+S\d+(\s+|$)/gi, ' ') // Removes trailing S2 or S1
    .replace(/\s+-\s+S\d+.*$/gi, '') // Removes - S2...
    .replace(/\s+/g, ' ')
    .trim();
}
