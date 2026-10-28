import React from 'react';
import { VideoItem } from '../types';
import { VideoCard } from './VideoCard';
import { PopcornTrendingCarousel } from './PopcornTrendingCarousel';
import { PopcornTrendingItem } from '../services/popcornApi';

interface VideoFeedProps {
  videos: VideoItem[];
  trendingItems?: PopcornTrendingItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onVideoClick: (videoId: string) => void;
  onOptionsClick?: (video: VideoItem) => void;
  onPopcornItemClick?: (item: PopcornTrendingItem) => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  videos,
  trendingItems = [],
  isLoading,
  error,
  onRetry,
  onVideoClick,
  onOptionsClick,
  onPopcornItemClick
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-butterYellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-12 text-center text-white/40 text-sm">
        Failed to load videos.
        <br />
        <button
          onClick={onRetry}
          className="mt-3 text-butterYellow font-semibold cursor-pointer underline hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-white/40 text-sm">
        No videos found
      </div>
    );
  }

  return (
    <div id="videoFeed" className="flex flex-col space-y-6 mt-6">
      {videos.map((video, index) => {
        const showTrendingAfter = (index + 1) === 2 && trendingItems.length > 0;
        const showSecondTrending = (index + 1) === 6 && trendingItems.length > 4;

        return (
          <React.Fragment key={video.id}>
            <VideoCard
              video={video}
              onClick={onVideoClick}
              onOptionsClick={onOptionsClick}
            />

            {/* Free scroll horizontal carousel after a couple of videos */}
            {showTrendingAfter && (
              <PopcornTrendingCarousel
                items={trendingItems}
                title="Trending Series & Movies"
                onItemClick={onPopcornItemClick}
              />
            )}

            {/* Second carousel deeper in the feed */}
            {showSecondTrending && (
              <PopcornTrendingCarousel
                items={[...trendingItems].reverse()}
                title="Popular Originals"
                onItemClick={onPopcornItemClick}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
