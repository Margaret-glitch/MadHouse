import React from 'react';
import { PopcornTrendingItem } from '../services/popcornApi';
import { FilmSlate, Play } from '@phosphor-icons/react';
import { ImageWithFallback } from './ImageWithFallback';

interface PopcornTrendingCarouselProps {
  items: PopcornTrendingItem[];
  title?: string;
  onItemClick?: (item: PopcornTrendingItem) => void;
}

export const PopcornTrendingCarousel: React.FC<PopcornTrendingCarouselProps> = ({
  items,
  title = 'Trending on Popcorn',
  onItemClick
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="my-6 select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center space-x-2">
          <FilmSlate size={18} weight="fill" className="text-butterYellow" />
          <h3 className="text-sm font-bold tracking-tight text-white uppercase">
            {title}
          </h3>
        </div>
        <span className="text-[11px] font-medium text-gray-500">
          Swipe & explore
        </span>
      </div>

      {/* Free Scroll Horizontal Carousel */}
      <div className="flex space-x-3.5 overflow-x-auto px-4 no-scrollbar py-1">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick && onItemClick(item)}
            className="flex-shrink-0 w-44 group cursor-pointer active:scale-95 transition-transform"
          >
            {/* Banner Media Container */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900 border border-black/10 shadow-sm">
              <ImageWithFallback
                src={item.cover || item.poster}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />

              {/* Episode / Multi-Season Tag */}
              {item.badgeTag && (
                <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md text-butterYellow border border-butterYellow/40 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                  {item.badgeTag}
                </div>
              )}

              {/* Play icon overlay on hover/active */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-butterYellow text-black flex items-center justify-center shadow-lg">
                  <Play size={16} weight="fill" />
                </div>
              </div>
            </div>

            {/* Title / Name */}
            <h4 className="text-xs font-semibold text-white mt-2 line-clamp-1 group-hover:text-butterYellow transition-colors">
              {item.title}
            </h4>
            {item.releaseTime && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                {item.releaseTime} {item.score ? `• ★ ${item.score}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
