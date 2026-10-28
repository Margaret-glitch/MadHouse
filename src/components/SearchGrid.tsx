import React from 'react';
import { VideoItem } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

interface SearchGridProps {
  videos: VideoItem[];
  onVideoClick: (videoId: string) => void;
}

export const SearchGrid: React.FC<SearchGridProps> = ({
  videos,
  onVideoClick
}) => {
  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-2 gap-x-2 gap-y-4">
        {videos.map((video) => (
          <article
            key={video.id}
            onClick={() => onVideoClick(video.id)}
            className="flex flex-col cursor-pointer active:scale-[0.98] transition-all group"
          >
            {/* Poster - Sharper corners, 10/14 aspect ratio like reels */}
            <div className="relative w-full aspect-[10/14] rounded-sm overflow-hidden bg-white/5 border border-white/5">
              <ImageWithFallback
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                loading="lazy"
              />
              
              {/* Subtle Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

              {/* Episodic Badge */}
              {video.badgeTag && (video.badgeTag.includes('Ep') || video.badgeTag.includes('S')) && (
                <div className="absolute top-1.5 left-1.5 pointer-events-none">
                  <span className="bg-butterYellow text-black text-[8px] font-black px-1.2 py-0.4 rounded-sm shadow-md uppercase tracking-tighter">
                    {video.badgeTag}
                  </span>
                </div>
              )}

              {/* Title & Info inside poster bottom */}
              <div className="absolute bottom-0 inset-x-0 p-2 flex flex-col justify-end">
                <h3 className="text-[10px] font-bold text-white line-clamp-1 leading-tight group-hover:text-butterYellow transition-colors">
                  {video.title}
                </h3>
                <p className="text-[8px] text-gray-400 font-medium truncate">
                  {video.timestamp || '2026'}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 mb-8 flex flex-col items-center justify-center">
        <div className="h-[1px] w-12 bg-white/10 mb-3" />
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
          End of result
        </p>
      </div>
    </div>
  );
};
