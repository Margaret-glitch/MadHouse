import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { StoryCategoryCarousel } from '../components/StoryCategoryCarousel';
import { StoryCircleCarousel } from '../components/StoryCircleCarousel';
import { ReelsMovieCarousel } from '../components/ReelsMovieCarousel';
import { VideoFeed } from '../components/VideoFeed';
import { VideoItem } from '../types';
import { yt, normalizeItem, CURATED_MOVIE_VIDEOS } from '../services/invidious';
import { getPopcornTrending, getWednesdayHero, getPopcornFeed, searchPopcorn, PopcornTrendingItem } from '../services/popcornApi';
import { usePlayer } from '../context/PlayerContext';
import { CATEGORIES } from '../components/CategoryCarousel';
import { SearchGrid } from '../components/SearchGrid';

interface HomePageProps {
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const HomePage: React.FC<HomePageProps> = ({ scrollContainerRef }) => {
  const { openVideo } = usePlayer();

  const [videosData, setVideosData] = useState<VideoItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<PopcornTrendingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShrunk, setIsShrunk] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  const [categoryStoryData, setCategoryStoryData] = useState<any[]>([]);

  const handleSearchQuery = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadFeed(selectedCategory);
      return;
    }
    setIsLoading(true);
    try {
      const results = await searchPopcorn(query);
      if (results && results.length > 0) {
        setVideosData(results.map(item => ({
          id: item.url || item.id,
          videoId: item.url || item.id,
          title: item.title,
          channelName: 'Popcorn Cinema',
          channelId: 'popcorn',
          views: '1080p HD',
          viewCount: 450000,
          timestamp: '2026',
          duration: item.badgeTag || 'Movie',
          badgeTag: item.badgeTag,
          lengthSeconds: 5400,
          likes: '45K',
          thumbnail: item.poster,
          avatar: item.poster
        })));
      } else {
        setVideosData([]);
      }
    } catch {
      setVideosData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  // Reference for hero video - Wednesday series from Popcorn API
  const [heroVideo, setHeroVideo] = useState<VideoItem | null>(null);

  // Load Wednesday series for the Hero Banner
  useEffect(() => {
    let isMounted = true;
    getWednesdayHero().then(wednesday => {
      if (isMounted && wednesday) {
        setHeroVideo({
          id: wednesday.url || wednesday.id,
          videoId: wednesday.url || wednesday.id,
          title: wednesday.title,
          channelName: 'Popcorn Originals',
          channelId: 'popcorn',
          views: '14.2M views',
          viewCount: 14200000,
          timestamp: '2022',
          duration: wednesday.badgeTag || 'S1-2',
          lengthSeconds: 3600,
          likes: '1.4M',
          thumbnail: wednesday.poster,
          avatar: wednesday.poster,
          description: "Follows Wednesday Addams' years as a student at Nevermore Academy as she attempts to master her emerging psychic ability."
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Load category story images
  useEffect(() => {
    let isMounted = true;
    const fetchCategoryImages = async () => {
      const stories = await Promise.all(CATEGORIES.map(async (cat) => {
        try {
          const feed = await getPopcornFeed(cat === 'All' ? 'latest' : cat);
          return {
            id: cat,
            name: cat,
            image: feed[0]?.poster || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=150&q=80'
          };
        } catch {
          return {
            id: cat,
            name: cat,
            image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=150&q=80'
          };
        }
      }));
      if (isMounted) setCategoryStoryData(stories);
    };
    fetchCategoryImages();
    return () => { isMounted = false; };
  }, []);

  // Load Popcorn Trending carousel items
  useEffect(() => {
    let isMounted = true;
    getPopcornTrending().then(items => {
      if (isMounted) {
        setTrendingItems(items);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [allReelsData, setAllReelsData] = useState<Record<string, VideoItem[]>>({});
  const [isReelsLoading, setIsReelsLoading] = useState(false);

  // Load category reels for "All" mode
  useEffect(() => {
    if (selectedCategory !== 'All') return;
    
    let isMounted = true;
    const fetchAllReels = async () => {
      setIsReelsLoading(true);
      const reels: Record<string, VideoItem[]> = {};
      
      // Filter out 'All' and 'Latest' to get specific genres
      const genres = CATEGORIES.filter(c => c !== 'All' && c !== 'Latest').slice(0, 5);
      
      await Promise.all(genres.map(async (genre) => {
        try {
          const feedItems = await getPopcornFeed(genre);
          if (feedItems && feedItems.length > 0) {
            reels[genre] = feedItems.map(item => ({
              id: item.url || item.id,
              videoId: item.url || item.id,
              title: item.title,
              channelName: genre,
              channelId: 'popcorn',
              views: 'HD',
              viewCount: 0,
              timestamp: 'Latest',
              duration: item.badgeTag || 'Movie',
              badgeTag: item.badgeTag,
              lengthSeconds: 0,
              likes: '',
              thumbnail: item.poster,
              avatar: item.poster
            }));
          }
        } catch (err) {
          console.error(`Failed to fetch reels for ${genre}`, err);
        }
      }));
      
      if (isMounted) {
        setAllReelsData(reels);
        setIsReelsLoading(false);
      }
    };
    
    fetchAllReels();
    return () => { isMounted = false; };
  }, [selectedCategory]);

  // Load feed data, curating by search keywords and watch history
  const loadFeed = useCallback(async (category: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let items: VideoItem[] = [];

      if (category === 'All' || category === 'Latest') {
        const feedItems = await getPopcornFeed('latest');
        if (feedItems && feedItems.length > 0) {
          items = feedItems.map(item => ({
            id: item.url || item.id,
            videoId: item.url || item.id,
            title: item.title,
            channelName: 'Popcorn Cinema',
            channelId: 'popcorn',
            views: '1080p HD',
            viewCount: 420000,
            timestamp: '2026',
            duration: item.badgeTag || 'Movie',
            badgeTag: item.badgeTag,
            lengthSeconds: 5400,
            likes: '38K',
            thumbnail: item.poster,
            avatar: item.poster
          }));
        } else {
          items = CURATED_MOVIE_VIDEOS;
        }
      } else {
        const feedItems = await getPopcornFeed(category);
        if (feedItems && feedItems.length > 0) {
          items = feedItems.map(item => ({
            id: item.url || item.id,
            videoId: item.url || item.id,
            title: item.title,
            channelName: `${category} • Popcorn`,
            channelId: 'popcorn',
            views: '380K views',
            viewCount: 380000,
            timestamp: 'Latest Release',
            duration: item.badgeTag || 'Movie',
            badgeTag: item.badgeTag,
            lengthSeconds: 5400,
            likes: '34K',
            thumbnail: item.poster,
            avatar: item.poster
          }));
        } else {
          items = [];
        }
      }

      setVideosData(items);
    } catch (err: any) {
      console.error('Feed loading error:', err);
      setVideosData(CURATED_MOVIE_VIDEOS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed('All');
  }, [loadFeed]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    loadFeed(category);
    // Smooth scroll to below hero if selecting a category
    const storiesEl = document.getElementById('storiesSection');
    if (storiesEl) {
      storiesEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScrollToTop = () => {
    if (scrollContainerRef && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Hysteresis scroll listener
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = scrollContainerRef && scrollContainerRef.current
        ? scrollContainerRef.current.scrollTop
        : window.scrollY;

      if (currentScrollY > 100 && !isShrunk) {
        setIsShrunk(true);
      } else if (currentScrollY < 50 && isShrunk) {
        setIsShrunk(false);
      }
    };

    const container = scrollContainerRef ? scrollContainerRef.current : window;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [scrollContainerRef, isShrunk]);

  const handlePlayHero = () => {
    if (heroVideo) {
      openVideo(heroVideo.id);
    } else {
      // Fallback to a search-compatible Wednesday URL if for some reason heroVideo isn't ready
      openVideo('/api/url/aHR0cHM6Ly93d3cud2F0Y2hzdG8ubmV0L3R2LXNlcmllcy93ZWRuZXNkYXktNzk1MDYv');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Dynamic Header Overlay */}
      <Header
        isShrunk={isShrunk}
        isTransparent={!isShrunk && !isSearchActive}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        onScrollToTop={handleScrollToTop}
        onSearchQuery={handleSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
      />

      <main className="flex-grow pb-32">
        {isSearchActive ? (
          <div className="pt-20">
            <SearchGrid
              videos={videosData}
              onVideoClick={(id) => openVideo(id)}
            />
          </div>
        ) : (
          <>
            {/* Full Height Hero Banner */}
            <HeroBanner
              heroVideo={heroVideo}
              onPlay={handlePlayHero}
            />

            {/* Story Style Category Filters */}
            <div id="storiesSection" className="bg-black">
              <StoryCategoryCarousel
                categories={categoryStoryData}
                selectedCategory={selectedCategory}
                onSelectCategory={handleCategorySelect}
              />
            </div>

            {/* Instagram Stories style Circle Carousel with grey borders */}
            <StoryCircleCarousel
              items={trendingItems}
              onItemClick={(item) => openVideo(item.id)}
            />

            {/* Dynamic Content: Multi-Reel for 'All', Grid for Categories */}
            {selectedCategory === 'All' ? (
              <>
                {isReelsLoading ? (
                  /* Simple Skeleton for reels */
                  [1, 2, 3].map(n => (
                    <div key={n} className="mb-8 px-4 animate-pulse">
                      <div className="h-3 bg-white/10 w-32 rounded mb-4" />
                      <div className="flex space-x-1 overflow-hidden">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-[160px] aspect-[10/14] bg-white/5 rounded-sm flex-shrink-0" />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  Object.entries(allReelsData).map(([genre, movies]) => (
                    <div key={genre} className="mb-8">
                      <div className="px-4 mb-2 flex items-center justify-between">
                        <h2 className="text-[10px] font-black text-butterYellow uppercase tracking-[0.2em] opacity-90">
                          {genre} Spotlight
                        </h2>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-butterYellow/30 to-transparent ml-4" />
                      </div>
                      <ReelsMovieCarousel
                        movies={movies}
                        onPlayMovie={(id) => openVideo(id)}
                      />
                    </div>
                  ))
                )}

                {/* Main Feed for 'All' */}
                <div className="px-4 mb-4">
                  <h2 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
                    Latest Releases
                  </h2>
                </div>
                <VideoFeed
                  videos={videosData}
                  trendingItems={trendingItems}
                  isLoading={isLoading}
                  error={error}
                  onRetry={() => loadFeed(selectedCategory)}
                  onVideoClick={(id) => openVideo(id)}
                  onPopcornItemClick={(item) => openVideo(item.id)}
                />
              </>
            ) : (
              /* Genre Category Grid View */
              <div className="mt-4">
                <div className="px-4 mb-6 flex items-center justify-between">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    {selectedCategory}
                  </h2>
                  <span className="text-[10px] font-bold text-butterYellow bg-butterYellow/10 px-2 py-0.5 rounded uppercase tracking-tighter">
                    {videosData.length} Results
                  </span>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-butterYellow border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <SearchGrid
                    videos={videosData}
                    onVideoClick={(id) => openVideo(id)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
