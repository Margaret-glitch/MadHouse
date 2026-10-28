import React from 'react';
import { Play, BookmarkSimple } from '@phosphor-icons/react';
import { VideoItem } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { ImageWithFallback } from './ImageWithFallback';
import { cleanMovieTitle } from '../utils/cleanTitle';

interface HeroBannerProps {
  heroVideo?: VideoItem | null;
  onPlay: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  heroVideo,
  onPlay
}) => {
  const { toggleWatchlist, isInWatchlist } = usePlayer();

  if (!heroVideo) {
    return (
      <section className="relative w-full h-[80vh] min-h-[600px] flex flex-col justify-end p-8 select-none overflow-hidden bg-neutral-950 animate-pulse">
        <div className="relative z-10 flex flex-col space-y-6 max-w-xl">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-24 bg-white/10 rounded-sm" />
              <div className="h-3 w-16 bg-white/10 rounded-sm" />
            </div>
            <div className="h-12 w-64 bg-white/10 rounded-2xl" />
            <div className="h-4 w-80 bg-white/10 rounded" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-32 h-12 bg-white/10 rounded-full" />
            <div className="w-14 h-14 bg-white/10 rounded-full" />
          </div>
        </div>
      </section>
    );
  }

  const title = cleanMovieTitle(heroVideo.title || 'Wednesday');
  const backgroundImage = heroVideo.thumbnail;
  const isSaved = isInWatchlist(heroVideo.id);

  return (
    <section
      className="relative w-full h-[80vh] min-h-[600px] flex flex-col justify-end p-8 select-none overflow-hidden bg-black"
    >
      <ImageWithFallback
        src={backgroundImage}
        className="absolute inset-0 w-full h-full object-cover"
        alt={title}
      />
      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* Banner Content */}
      <div className="relative z-10 flex flex-col space-y-6 max-w-xl animate-fadeIn">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <span className="bg-butterYellow text-black text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-tighter">
              Original Series
            </span>
            <span className="text-white/80 text-xs font-semibold">
              {heroVideo?.duration || 'S1-2'} • Netflix
            </span>
          </div>
          <h1 className="text-5xl font-black text-white leading-none tracking-tight drop-shadow-2xl">
            {title}
          </h1>
          <p className="text-gray-300 text-sm line-clamp-2 max-w-sm font-medium leading-relaxed drop-shadow-md">
            {heroVideo?.description || "Follows Wednesday Addams' years as a student at Nevermore Academy as she attempts to master her emerging psychic ability."}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={onPlay}
            className="bg-white text-black font-bold text-base px-8 py-3.5 rounded-full flex items-center space-x-2.5 active:scale-95 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer hover:bg-butterYellow"
          >
            <Play size={22} weight="fill" />
            <span>Play</span>
          </button>

          <button
            onClick={() => heroVideo && toggleWatchlist(heroVideo)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 border-[1.5px] ${
              isSaved 
                ? 'bg-butterYellow border-butterYellow text-black shadow-[0_0_20px_rgba(229,192,88,0.4)]' 
                : 'glass-circle-btn border-white/20 text-white hover:border-white/50'
            }`}
            aria-label="Add to watchlist"
          >
            <BookmarkSimple size={26} weight={isSaved ? 'fill' : 'bold'} />
          </button>
        </div>
      </div>
    </section>
  );
};
