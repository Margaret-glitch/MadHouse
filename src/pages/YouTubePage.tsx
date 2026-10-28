import React, { useState } from 'react';
import { YoutubeLogo, MagnifyingGlass, X } from '@phosphor-icons/react';
import { VideoFeed } from '../components/VideoFeed';
import { VideoItem } from '../types';
import { yt, normalizeItem, CURATED_MOVIE_VIDEOS } from '../services/invidious';
import { searchPopcorn } from '../services/popcornApi';
import { usePlayer } from '../context/PlayerContext';
import { SearchGrid } from '../components/SearchGrid';

export const YouTubePage: React.FC = () => {
  const { openVideo } = usePlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoItem[]>(CURATED_MOVIE_VIDEOS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults(CURATED_MOVIE_VIDEOS);
      return;
    }

    try {
      const savedKeywords: string[] = JSON.parse(
        localStorage.getItem('popcorn_search_keywords') || '[]'
      );
      const updated = [
        trimmed,
        ...savedKeywords.filter(k => k.toLowerCase() !== trimmed.toLowerCase())
      ].slice(0, 15);
      localStorage.setItem('popcorn_search_keywords', JSON.stringify(updated));
    } catch {}

    setIsLoading(true);
    setError(null);
    try {
      const data = await yt.search(trimmed, { type: 'video' });
      if (Array.isArray(data) && data.length > 0) {
        setResults(data.map(normalizeItem).filter(v => v.id));
      } else {
        const filtered = CURATED_MOVIE_VIDEOS.filter(v =>
          v.title.toLowerCase().includes(trimmed.toLowerCase())
        );
        setResults(filtered.length > 0 ? filtered : CURATED_MOVIE_VIDEOS);
      }
    } catch {
      const filtered = CURATED_MOVIE_VIDEOS.filter(v =>
        v.title.toLowerCase().includes(trimmed.toLowerCase())
      );
      setResults(filtered.length > 0 ? filtered : CURATED_MOVIE_VIDEOS);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pb-32 select-none bg-black text-white">
      {/* Header with Borderless Expandable Search Bar */}
      <header className="sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 glass-nav transition-all duration-300">
        {isSearchActive ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex-1 flex items-center space-x-2 animate-fadeIn transition-all duration-300"
          >
            <button
              type="submit"
              className="text-butterYellow focus:outline-none p-1 cursor-pointer flex-shrink-0"
              aria-label="Submit search"
            >
              <MagnifyingGlass size={22} weight="bold" />
            </button>

            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Search movies, trailers..."
              className="w-full bg-transparent text-sm font-medium text-white placeholder-white/30 border-none outline-none focus:ring-0 px-1"
            />

            <button
              type="button"
              onClick={() => {
                setIsSearchActive(false);
                setQuery('');
                setResults(CURATED_MOVIE_VIDEOS);
              }}
              className="text-white/50 hover:text-white p-1 cursor-pointer flex-shrink-0"
              aria-label="Close search"
            >
              <X size={20} weight="bold" />
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-center space-x-2 mr-3">
              <YoutubeLogo size={28} weight="fill" className="text-red-600" />
              <span className="text-xl font-bold tracking-tight text-white">
                Explore
              </span>
            </div>

            <div className="flex items-center space-x-3 text-white flex-shrink-0">
              <button
                onClick={() => setIsSearchActive(true)}
                className="focus:outline-none active:opacity-60 transition-opacity p-1 cursor-pointer text-white"
                aria-label="Open search"
              >
                <MagnifyingGlass size={24} weight="bold" />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Results Feed */}
      <main className="flex-grow pt-4">
        <div className="px-4 mb-2">
          <h2 className="text-sm font-bold text-white/40 uppercase tracking-wide">
            {query ? `Results for "${query}"` : 'Trending on Explore'}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-butterYellow border-t-transparent rounded-full animate-spin" />
          </div>
        ) : query ? (
          <SearchGrid
            videos={results}
            onVideoClick={(id) => openVideo(id)}
          />
        ) : (
          <VideoFeed
            videos={results}
            isLoading={isLoading}
            error={error}
            onRetry={() => handleSearch(query)}
            onVideoClick={(id) => openVideo(id)}
          />
        )}
      </main>
    </div>
  );
};
