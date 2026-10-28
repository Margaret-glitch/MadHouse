import React from 'react';
import { Play, DownloadSimple, FilmSlate } from '@phosphor-icons/react';
import { VideoItem } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

interface ReelsMovieCarouselProps {
  movies: VideoItem[];
  onPlayMovie: (videoId: string) => void;
}

export const ReelsMovieCarousel: React.FC<ReelsMovieCarouselProps> = ({
  movies,
  onPlayMovie
}) => {
  if (!movies || movies.length === 0) return null;

  return (
    <div className="w-full my-4 select-none">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center space-x-2">
          <FilmSlate size={20} weight="fill" className="text-butterYellow animate-pulse" />
          <h2 className="text-base font-extrabold tracking-tight text-white uppercase">
            Featured Movie Reels
          </h2>
        </div>
        <span className="text-xs font-semibold text-gray-400">
          Swipe Reels
        </span>
      </div>

      {/* Snap-aligned horizontal Reels Carousel */}
      <div className="flex overflow-x-auto px-4 pb-4 pt-1 snap-x snap-mandatory no-scrollbar">
        {movies.map((movie) => (
          <div
            key={movie.id}
            onClick={() => onPlayMovie(movie.id)}
            className="w-[160px] sm:w-[200px] aspect-[10/14] rounded-sm overflow-hidden relative snap-start flex-shrink-0 shadow-lg group cursor-pointer border border-white/5 bg-black active:scale-[0.98] transition-all duration-300"
            style={{ marginRight: '0.2em' }}
          >
            {/* Background Poster */}
            <ImageWithFallback
              src={movie.thumbnail}
              alt={movie.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out opacity-80 group-hover:opacity-100"
              loading="lazy"
            />

            {/* Cinematic Gradient Overlays - More subtle */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

            {/* Minimalist Top Badge - Only Episodic info if present */}
            {movie.badgeTag && (movie.badgeTag.includes('Ep') || movie.badgeTag.includes('S')) && (
              <div className="absolute top-2 left-2 flex items-center pointer-events-none">
                <span className="bg-butterYellow text-black text-[9px] font-black px-1.5 py-0.5 rounded-sm shadow-md uppercase tracking-tighter">
                  {movie.badgeTag}
                </span>
              </div>
            )}

            {/* Bottom Content Area - Minimalist */}
            <div className="absolute bottom-0 inset-x-0 p-2.5 flex flex-col justify-end text-white">
              <h3 className="text-[11px] font-bold text-white line-clamp-1 leading-tight drop-shadow-sm group-hover:text-butterYellow transition-colors">
                {movie.title}
              </h3>
              <p className="text-[9px] text-gray-400 font-medium truncate">
                {movie.timestamp || '2026'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
