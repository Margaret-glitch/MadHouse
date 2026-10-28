import React from 'react';
import { DotsThreeVertical } from '@phosphor-icons/react';
import { ImageWithFallback } from './ImageWithFallback';
import { VideoItem } from '../types';

interface VideoCardProps {
  video: VideoItem;
  onClick: (videoId: string) => void;
  onOptionsClick?: (video: VideoItem) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onClick,
  onOptionsClick
}) => {
  return (
    <article
      onClick={() => onClick(video.id)}
      className="flex flex-col cursor-pointer active:opacity-95 transition-opacity select-none group"
    >
      <div className="relative w-full aspect-video bg-gray-200 overflow-hidden">
        <ImageWithFallback
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
          loading="lazy"
        />
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded-sm font-medium">
            {video.duration}
          </span>
        )}
      </div>

      <div className="flex items-start px-4 mt-3 space-x-3">
        <ImageWithFallback
          src={video.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
          alt={video.channelName}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {video.title}
          </h3>
          <p className="text-xs text-white/50 mt-1">
            {video.channelName} &bull; {video.views}{' '}
            {video.timestamp ? `&bull; ${video.timestamp}` : ''}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOptionsClick?.(video);
          }}
          className="text-white/40 focus:outline-none p-1 hover:text-white cursor-pointer"
          aria-label="More options"
        >
          <DotsThreeVertical size={20} weight="bold" />
        </button>
      </div>
    </article>
  );
};
