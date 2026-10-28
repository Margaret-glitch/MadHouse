import React from 'react';
import { PopcornTrendingItem } from '../services/popcornApi';
import { ImageWithFallback } from './ImageWithFallback';

interface StoryCircleCarouselProps {
  items: PopcornTrendingItem[];
  onItemClick?: (item: PopcornTrendingItem) => void;
}

export const StoryCircleCarousel: React.FC<StoryCircleCarouselProps> = ({
  items,
  onItemClick
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="w-full py-3 bg-transparent select-none overflow-hidden">
      <div className="flex space-x-4 overflow-x-auto px-4 no-scrollbar">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick && onItemClick(item)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
          >
            {/* Grey Circle Border resembling Instagram stories */}
            <div className="w-16 h-16 rounded-full p-[2px] border-[1.5px] border-white/20 group-hover:border-butterYellow transition-colors flex items-center justify-center bg-black/40 shadow-sm overflow-hidden">
              <ImageWithFallback
                src={item.cover || item.poster}
                alt={item.title}
                className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            {/* Title below */}
            <span className="text-[10px] font-bold text-white/70 mt-1.5 max-w-[64px] truncate text-center group-hover:text-white uppercase tracking-tighter">
              {item.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
