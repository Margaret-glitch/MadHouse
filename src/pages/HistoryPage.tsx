import React from 'react';
import { ClockCounterClockwise, Play } from '@phosphor-icons/react';
import { usePlayer } from '../context/PlayerContext';
import { VideoCard } from '../components/VideoCard';

export const HistoryPage: React.FC = () => {
  const { history, openVideo } = usePlayer();

  return (
    <div className="min-h-screen flex flex-col justify-between pb-32 select-none bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full flex justify-between items-center px-4 py-3 glass-nav transition-all duration-300">
        <div className="flex items-center space-x-2">
          <ClockCounterClockwise
            size={26}
            weight="bold"
            className="text-butterYellow"
          />
          <h1 className="text-xl font-bold tracking-tight text-white">
            Watch History
          </h1>
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {history.length} {history.length === 1 ? 'item' : 'items'}
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <ClockCounterClockwise size={48} className="text-white/10 mb-3" />
            <h3 className="text-base font-semibold text-white/40">
              No watch history yet
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Videos and movie trailers you watch will automatically appear here.
            </p>
          </div>
        ) : (
          <div>
            <div className="px-4 mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Recently Watched
              </span>
              <button
                onClick={() => openVideo(history[0].id)}
                className="text-xs text-butterYellow font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
              >
                <Play size={12} weight="fill" />
                <span>Resume Latest</span>
              </button>
            </div>

            <div className="flex flex-col space-y-6">
              {history.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={(id) => openVideo(id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
