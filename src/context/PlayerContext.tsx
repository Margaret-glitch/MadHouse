import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { StreamDetails, VideoItem } from '../types';
import { yt, CURATED_MOVIE_VIDEOS } from '../services/invidious';
import { cacheAudioTrack, cacheMedia, getCachedMedia } from '../services/audioCache';
import { useAuth } from './AuthContext';
import {
  saveRemoteHistory,
  loadRemoteHistory,
  saveRemoteWatchlist,
  loadRemoteWatchlist
} from '../services/madhouseDb';

interface PlayerContextType {
  isOpen: boolean;
  isMiniPlayer: boolean;
  currentVideoId: string | null;
  streamDetails: StreamDetails | null;
  isLoadingStream: boolean;
  isBuffering: boolean;
  errorMessage: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  FREE_PREVIEW_LIMIT: number;
  hasActiveSubscription: boolean;
  history: VideoItem[];
  watchlist: VideoItem[];
  openVideo: (videoId: string, startTime?: number) => Promise<void>;
  playDirectUrl: (url: string, title?: string, episodeIndex?: number) => boolean | void;
  closeVideo: () => void;
  minimizePlayer: () => void;
  restoreFullscreen: () => void;
  togglePlayPause: (onTheMoveMode?: boolean) => void;
  syncPlay: (onTheMoveMode?: boolean) => Promise<void>;
  syncPause: () => void;
  skip: (seconds: number) => void;
  seek: (percent: number) => void;
  toggleWatchlist: (video: VideoItem) => void;
  isInWatchlist: (videoId: string) => boolean;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setIsBuffering: React.Dispatch<React.SetStateAction<boolean>>;
  isAudioReady: boolean;
  audioDownloadProgress: number | null;
  isHDMode: boolean;
  setHDMode: (enabled: boolean) => void;
  activeDirectUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export const FREE_PREVIEW_LIMIT = 600; // 10 minutes in seconds

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [streamDetails, setStreamDetails] = useState<StreamDetails | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isAudioReady, setIsAudioReady] = useState(true);
  const [audioDownloadProgress, setAudioDownloadProgress] = useState<number | null>(null);
  const [isHDMode, setIsHDMode] = useState(false);
  const [activeDirectUrl, setActiveDirectUrl] = useState<string | null>(null);

  const { user, isVip, subscription } = useAuth();
  const hasActiveSubscription = Boolean(user && isVip && subscription?.entitlement);

  // Real history and watchlist stored in localStorage
  const [history, setHistory] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('popcorn_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [watchlist, setWatchlist] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('popcorn_watchlist');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Load from remote userData folder on mount or when user changes
  useEffect(() => {
    let active = true;
    const fetchRemote = async () => {
      const userIdentifier = user?.email || user?.id || null;
      try {
        const remoteH = await loadRemoteHistory(userIdentifier);
        if (active && remoteH && remoteH.length > 0) {
          setHistory(prev => {
            const map = new Map<string, VideoItem>();
            remoteH.forEach(item => map.set(String(item.id), item));
            prev.forEach(item => {
              if (!map.has(String(item.id))) map.set(String(item.id), item);
            });
            return Array.from(map.values()).slice(0, 50);
          });
        }

        const remoteW = await loadRemoteWatchlist(userIdentifier);
        if (active && remoteW && remoteW.length > 0) {
          setWatchlist(prev => {
            const map = new Map<string, VideoItem>();
            remoteW.forEach(item => map.set(String(item.id), item));
            prev.forEach(item => {
              if (!map.has(String(item.id))) map.set(String(item.id), item);
            });
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Initial remote load warning:', err);
      }
    };
    fetchRemote();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('popcorn_history', JSON.stringify(history));
    } catch {}
    if (history.length > 0) {
      saveRemoteHistory(history, user?.email || user?.id);
    }
  }, [history, user]);

  useEffect(() => {
    try {
      localStorage.setItem('popcorn_watchlist', JSON.stringify(watchlist));
    } catch {}
    if (watchlist.length > 0) {
      saveRemoteWatchlist(watchlist, user?.email || user?.id);
    }
  }, [watchlist, user]);

  const toggleWatchlist = useCallback((video: VideoItem) => {
    setWatchlist(prev => {
      const exists = prev.some(item => String(item.id) === String(video.id));
      if (exists) {
        return prev.filter(item => String(item.id) !== String(video.id));
      } else {
        // Ensure robust metadata and valid image URLs are saved
        const resolvedThumb =
          video.thumbnail ||
          video.avatar ||
          `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

        const robustVideo: VideoItem = {
          ...video,
          id: String(video.id),
          videoId: String(video.id),
          thumbnail: resolvedThumb,
          avatar: video.avatar || resolvedThumb,
          timestamp: video.timestamp || 'Latest'
        };
        return [robustVideo, ...prev];
      }
    });
  }, []);

  const isInWatchlist = useCallback((videoId: string) => {
    return watchlist.some(item => String(item.id) === String(videoId));
  }, [watchlist]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const syncPlay = useCallback(async (onTheMoveMode = false) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const hasAudioTrack = Boolean(
      audio && audio.src && !audio.src.endsWith('/') && audio.src !== window.location.href
    );

    // Enforce 10-minute preview limit
    const current = (video && !video.paused ? video.currentTime : 0) || (audio && !audio.paused ? audio.currentTime : 0) || currentTime;
    if (!hasActiveSubscription && current >= FREE_PREVIEW_LIMIT) {
      if (video) video.pause();
      if (audio) audio.pause();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setIsBuffering(false);

    try {
      if (onTheMoveMode) {
        // "On the move" specifically prioritizes high-quality audio
        if (video && !video.paused) video.pause();
        if (hasAudioTrack && audio) {
          if (video && Math.abs(audio.currentTime - video.currentTime) > 0.5) {
            audio.currentTime = video.currentTime;
          }
          await audio.play();
        } else if (video) {
          await video.play();
        }
      } else {
        if (video) {
          // If activeDirectUrl is playing or no backtrack audio track is set, ensure video is unmuted
          const hasValidAudio = Boolean(
            !activeDirectUrl && audio && audio.src && !audio.src.endsWith('/') && audio.src !== window.location.href
          );
          const useBacktrack = !activeDirectUrl && (isHDMode || (hasValidAudio && isAudioReady));
          
          video.muted = useBacktrack;
          if (!useBacktrack) {
            video.volume = 1.0;
          }
          await video.play();

          if (useBacktrack && audio) {
            if (Math.abs(audio.currentTime - video.currentTime) > 0.3) {
              audio.currentTime = video.currentTime;
            }
            await audio.play().catch(() => {});
          } else if (audio && !audio.paused) {
            audio.pause();
          }
        } else if (hasAudioTrack && audio) {
          await audio.play();
        }
      }
    } catch (err) {
      console.warn('Playback play request error:', err);
    }
  }, [isHDMode, isAudioReady, activeDirectUrl, hasActiveSubscription, currentTime]);

  const syncPause = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) video.pause();
    if (audio) audio.pause();
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback((onTheMoveMode = false) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const hasAudioTrack = Boolean(
      audio && audio.src && !audio.src.endsWith('/') && audio.src !== window.location.href
    );

    const activeElement = onTheMoveMode && hasAudioTrack ? audio : video;
    if (!activeElement) return;

    if (activeElement.paused) {
      syncPlay(onTheMoveMode);
    } else {
      syncPause();
    }
  }, [syncPlay, syncPause]);

  const loadingVideoId = useRef<string | null>(null);

  const openVideo = useCallback(async (videoId: string, startTime = 0) => {
    if (isMiniPlayer) {
      setIsMiniPlayer(false);
    }
    setIsOpen(true);
    setCurrentVideoId(videoId);
    loadingVideoId.current = videoId;
    setIsLoadingStream(true);
    setIsBuffering(true);
    setErrorMessage(null);
    setCurrentTime(startTime);
    setProgress(0);
    setIsAudioReady(true);
    setAudioDownloadProgress(null);
    setActiveDirectUrl(null);

    syncPause();

    // Clean slate reset on video and audio elements
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }

    try {
      let details: StreamDetails;

      if (/^\d{6,}$/.test(videoId)) {
        // Popcorn API Movie / Series stream
        const popRes = await fetch(`https://popcorn.levity.click/api/detail/${videoId}`).catch(() => null);
        const popJson = popRes && popRes.ok ? await popRes.json() : null;
        const popData = popJson?.data || {};

        const streamUrl = `https://popcorn.levity.click/api/watch/${videoId}?quality=720p`;
        details = {
          id: videoId,
          title: (popData.title || 'Popcorn Movie').replace(/\[.*?\]/g, '').trim(),
          author: 'Popcorn Originals',
          authorId: 'popcorn',
          lengthSeconds: popData.runtime ? 5400 : 3600,
          viewCount: 8500000,
          description: popData.description || 'Streaming on Popcorn',
          publishedText: popData.releaseTime || '2023',
          thumbnails: [{ url: popData.cover || popData.poster || '', quality: 'high' }],
          authorThumbnails: [{ url: popData.poster || popData.cover || '', width: 100, height: 100 }],
          progressive: [
            { url: streamUrl, qualityLabel: '720p HD', container: 'mp4' },
            { url: `https://popcorn.levity.click/api/watch/${videoId}?quality=1080p`, qualityLabel: '1080p FHD', container: 'mp4' }
          ],
          bestProgressive: { url: streamUrl, qualityLabel: '720p HD', container: 'mp4' },
          bestAudio: { url: `https://popcorn.levity.click/api/watch/${videoId}?quality=audio`, bitrate: '128k' } as any,
          adaptiveVideo: [],
          adaptiveAudio: [],
          recommended: []
        };
      } else if (videoId.startsWith('/api/url/') || videoId.includes('/api/url/')) {
        const cleanPath = videoId.startsWith('http') ? new URL(videoId).pathname : videoId;
        const popRes = await fetch(`https://popcorn.levity.click${cleanPath}`).catch(() => null);
        const data = popRes && popRes.ok ? await popRes.json() : null;

        let ytDetails: StreamDetails | null = null;
        if (data?.trailer?.url) {
          const ytMatch = data.trailer.url.match(/(?:youtu\.be\/|v=)([^?&]+)/);
          if (ytMatch) {
            ytDetails = await yt.getStreams(ytMatch[1]).catch(() => null);
          }
        }

        if (ytDetails) {
          details = {
            ...ytDetails,
            downloads: data?.downloads || []
          };
        } else {
          const fallbackUrl = data?.downloads?.[0]?.url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
          details = {
            id: videoId,
            title: (data?.title || 'Popcorn Movie').replace(/^DOWNLOAD\s+/i, '').replace(/\[.*?\]/g, '').trim(),
            author: 'Popcorn Cinema',
            authorId: 'popcorn',
            lengthSeconds: 5400,
            viewCount: 450000,
            description: data?.synopsis || 'Streaming on Popcorn',
            publishedText: String(data?.year || '2026'),
            progressive: [{ url: fallbackUrl, qualityLabel: '1080p HD', container: 'mp4' }],
            bestProgressive: { url: fallbackUrl, qualityLabel: '1080p HD', container: 'mp4' },
            bestAudio: null,
            adaptiveVideo: [],
            adaptiveAudio: [],
            recommended: [],
            downloads: data?.downloads || []
          };
        }
      } else {
        details = await yt.getStreams(videoId);
      }

      if (loadingVideoId.current !== videoId) return;

      setStreamDetails(details);
      if (details.lengthSeconds) {
        setDuration(details.lengthSeconds);
      }

      const muxedUrl = (details.progressive && details.progressive[0]?.url) || details.bestProgressive?.url || '';
      const hdUrl = (details.adaptiveVideo && details.adaptiveVideo[0]?.url) || muxedUrl;
      const streamUrl = isHDMode ? hdUrl : muxedUrl;
      const audioUrl = details.bestAudio?.url || '';

      // 1. PRIORITIZE AUDIO BACKTRACK (Fetch first, backgrounded)
      if (audioUrl) {
        setIsAudioReady(false);
        setAudioDownloadProgress(2);
        
        cacheAudioTrack(videoId, audioUrl, (pct) => {
          if (loadingVideoId.current === videoId) setAudioDownloadProgress(pct);
        }).then((localUrl) => {
          if (loadingVideoId.current !== videoId) return;
          if (audioRef.current) {
            audioRef.current.src = localUrl;
            if (videoRef.current) {
              audioRef.current.currentTime = videoRef.current.currentTime;
              // If video is already playing, syncPlay will now detect isAudioReady=true and switch to backtrack
              if (isPlaying) syncPlay(false);
            }
          }
          setIsAudioReady(true);
          setAudioDownloadProgress(null);
        }).catch(() => {
          if (loadingVideoId.current !== videoId) return;
          setIsAudioReady(true); // Fallback to streaming audio
          setAudioDownloadProgress(null);
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.load();
          }
        });
      } else {
        setIsAudioReady(true);
      }

      // 2. LOAD VIDEO (With Background Caching)
      const cacheKey = `video_${videoId}_${isHDMode ? 'hd' : 'mux'}`;
      const cachedVideo = await getCachedMedia(cacheKey);
      
      if (videoRef.current) {
        videoRef.current.src = cachedVideo || streamUrl;
        videoRef.current.load();
        if (startTime > 0) videoRef.current.currentTime = startTime;
        
        // Start playing the available video stream immediately
        syncPlay(false);
        
        // If not cached, start background caching for future plays
        if (!cachedVideo && streamUrl) {
          cacheMedia(cacheKey, streamUrl).catch(() => {});
        }
      }

      // Resolve thumbnail & avatar
      const resolvedThumbnail =
        details.thumbnails?.[0]?.url ||
        details.authorThumbnails?.[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const resolvedAvatar =
        details.authorThumbnails?.[0]?.url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(details.author || 'MadHouse')}&background=111&color=fff&bold=true`;

      // Add to history
      const matched: VideoItem = {
        id: videoId,
        videoId,
        title: details.title,
        channelName: details.author,
        channelId: details.authorId,
        views: `${(details.viewCount / 1000).toFixed(0)}K views`,
        viewCount: details.viewCount,
        timestamp: details.publishedText || 'Recently',
        duration: 'Movie',
        lengthSeconds: details.lengthSeconds,
        likes: '45K',
        thumbnail: resolvedThumbnail,
        avatar: resolvedAvatar
      };

      setHistory(prev => [matched, ...prev.filter(i => String(i.id) !== String(videoId))].slice(0, 50));

      // Auto-repair watchlist item thumbnail & title when video is played
      setWatchlist(prev => prev.map(item => {
        if (String(item.id) === String(videoId)) {
          return {
            ...item,
            title: details.title || item.title,
            thumbnail: resolvedThumbnail,
            avatar: resolvedAvatar
          };
        }
        return item;
      }));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to load video stream');
    } finally {
      setIsLoadingStream(false);
    }
  }, [isMiniPlayer, syncPlay, syncPause, isHDMode, isPlaying]);

  const playDirectUrl = useCallback((url: string, title = 'External Stream', episodeIndex?: number) => {
    // Assert inability to watch episodes past episode 1 without active subscription
    if (!hasActiveSubscription && typeof episodeIndex === 'number' && episodeIndex > 0) {
      console.warn('Playback blocked: Episode is locked for non-VIP users.');
      return false;
    }

    if (isMiniPlayer) setIsMiniPlayer(false);
    setIsOpen(true);
    setActiveDirectUrl(url);
    setIsLoadingStream(false);
    setIsBuffering(true);
    setErrorMessage(null);
    setCurrentTime(0);
    setProgress(0);
    setIsAudioReady(true);
    setAudioDownloadProgress(null);

    syncPause();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.src = url;
      videoRef.current.load();
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
      }).catch(() => {
        syncPlay(false);
      });
    }

    // Only set a generic streamDetails object if we don't already have one (persistent metadata)
    if (!streamDetails) {
      setStreamDetails({
        id: 'direct',
        title,
        author: 'Direct Link',
        authorId: 'direct',
        lengthSeconds: 0,
        viewCount: 0,
        description: 'Streaming from direct download link',
        publishedText: 'Live',
        progressive: [{ url, qualityLabel: 'Direct', container: 'mkv' }],
        bestProgressive: { url, qualityLabel: 'Direct', container: 'mkv' },
        bestAudio: null,
        adaptiveVideo: [],
        adaptiveAudio: [],
        recommended: []
      } as any);
    }
    return true;
  }, [isMiniPlayer, syncPlay, syncPause, streamDetails, hasActiveSubscription]);

  const closeVideo = useCallback(() => {
    syncPause();
    if (videoRef.current) {
      videoRef.current.src = '';
    }
    if (audioRef.current) {
      audioRef.current.src = '';
    }
    setIsOpen(false);
    setIsMiniPlayer(false);
    setCurrentVideoId(null);
    setStreamDetails(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    setActiveDirectUrl(null);
  }, [syncPause]);

  const minimizePlayer = useCallback(() => {
    setIsMiniPlayer(true);
  }, []);

  const restoreFullscreen = useCallback(() => {
    setIsMiniPlayer(false);
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const dur = video?.duration || audio?.duration || streamDetails?.lengthSeconds || 0;
    const current = video && !video.paused ? video.currentTime : audio ? audio.currentTime : 0;
    let target = Math.max(0, Math.min(current + seconds, dur || 0));

    if (!hasActiveSubscription && target > FREE_PREVIEW_LIMIT) {
      target = FREE_PREVIEW_LIMIT;
    }

    if (video) video.currentTime = target;
    if (audio && audio.src) audio.currentTime = target;

    setCurrentTime(target);
    if (dur > 0) {
      setProgress((target / dur) * 100);
    }
  }, [streamDetails, hasActiveSubscription]);

  const seek = useCallback((percent: number) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const dur = video?.duration || audio?.duration || streamDetails?.lengthSeconds || 0;
    if (!dur) return;

    let targetTime = (percent / 100) * dur;
    if (!hasActiveSubscription && targetTime > FREE_PREVIEW_LIMIT) {
      targetTime = FREE_PREVIEW_LIMIT;
    }

    if (video) video.currentTime = targetTime;
    if (audio && audio.src) audio.currentTime = targetTime;

    setCurrentTime(targetTime);
    setProgress(dur > 0 ? (targetTime / dur) * 100 : percent);
  }, [streamDetails, hasActiveSubscription]);

  const setHDMode = useCallback((enabled: boolean) => {
    setIsHDMode(enabled);
    if (currentVideoId) {
      const resumeTime = videoRef.current?.currentTime || 0;
      openVideo(currentVideoId, resumeTime);
    }
  }, [currentVideoId, openVideo]);

  return (
    <PlayerContext.Provider
      value={{
        isOpen,
        isMiniPlayer,
        currentVideoId,
        streamDetails,
        isLoadingStream,
        isBuffering,
        errorMessage,
        isPlaying,
        currentTime,
        duration,
        progress,
        FREE_PREVIEW_LIMIT,
        hasActiveSubscription,
        history,
        watchlist,
        openVideo,
        playDirectUrl,
        closeVideo,
        minimizePlayer,
        restoreFullscreen,
        togglePlayPause,
        syncPlay,
        syncPause,
        skip,
        seek,
        toggleWatchlist,
        isInWatchlist,
        setCurrentTime,
        setDuration,
        setProgress,
        setIsPlaying,
        setIsBuffering,
        isAudioReady,
        audioDownloadProgress,
        isHDMode,
        setHDMode,
        activeDirectUrl,
        videoRef,
        audioRef
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
