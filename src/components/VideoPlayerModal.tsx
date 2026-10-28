import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CaretDown,
  X,
  Rewind,
  FastForward,
  Play,
  Pause,
  SpinnerGap,
  CornersOut,
  CornersIn,
  PictureInPicture,
  ThumbsUp,
  ThumbsDown,
  ShareNetwork,
  DownloadSimple,
  BookmarkSimple,
  Lock,
  LockOpen,
  Crown
} from '@phosphor-icons/react';
import { usePlayer, FREE_PREVIEW_LIMIT } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../utils/format';
import { normalizeItem } from '../services/invidious';
import { SubscriptionCheckoutModal } from './SubscriptionCheckoutModal';
import { AuthModal } from './AuthModal';

export const VideoPlayerModal: React.FC = () => {
  const { user, isVip, subscription, refreshSubscription } = useAuth();
  const hasActiveSub = Boolean(user && isVip && subscription?.entitlement);

  const {
    isOpen,
    isMiniPlayer,
    streamDetails,
    isLoadingStream,
    isBuffering,
    errorMessage,
    isPlaying,
    currentTime,
    duration,
    progress,
    closeVideo,
    minimizePlayer,
    restoreFullscreen,
    togglePlayPause,
    skip,
    seek,
    setCurrentTime,
    setDuration,
    setProgress,
    setIsPlaying,
    setIsBuffering,
    openVideo,
    playDirectUrl,
    videoRef,
    audioRef,
    toggleWatchlist,
    isInWatchlist,
    currentVideoId,
    isAudioReady,
    audioDownloadProgress,
    isHDMode,
    setHDMode,
    activeDirectUrl
  } = usePlayer();

  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 10-Minute Free Preview Limit Reached state & Modals
  const [isPreviewLimitReached, setIsPreviewLimitReached] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleOpenSubscriptionFlow = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowSubscriptionModal(true);
    }
  };

  // Music Mode ("On the move" - plays audio only, halts video rendering)
  const [isOnTheMove, setIsOnTheMove] = useState(false);

  // Smooth Rate-Based Drift Adjustment Loop (Zero Buffer Thrashing)
  useEffect(() => {
    if (!isPlaying || isOnTheMove || !isHDMode) return;

    let animId: number;
    const syncLoop = () => {
      const video = videoRef.current;
      const audio = audioRef.current;

      if (
        video &&
        audio &&
        audio.src &&
        !video.paused &&
        !video.seeking &&
        !audio.seeking
      ) {
        const drift = video.currentTime - audio.currentTime;

        if (Math.abs(drift) > 0.6) {
          // Hard snap for large jumps (scrubbing/skipping)
          audio.currentTime = video.currentTime;
          audio.playbackRate = 1.0;
        } else if (drift > 0.05) {
          // Audio is slightly behind: speed up audio by 8% to catch up smoothly
          audio.playbackRate = 1.08;
        } else if (drift < -0.05) {
          // Audio is slightly ahead: slow down audio by 8%
          audio.playbackRate = 0.92;
        } else {
          // In sync (within 50ms): reset to normal
          if (audio.playbackRate !== 1.0) {
            audio.playbackRate = 1.0;
          }
        }
      }

      animId = requestAnimationFrame(syncLoop);
    };

    animId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isOnTheMove, videoRef, audioRef]);

  // Binary Download state with real progress tracking
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Quality selection state (default to 'auto' or highest quality)
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');

  const handleQualitySelect = (fmt: any) => {
    const qLabel = fmt.qualityLabel || fmt.quality || (fmt.bitrate ? `${Math.round(fmt.bitrate / 1000)}kbps` : 'Audio');
    setSelectedQuality(qLabel);

    if (fmt.url && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;

      if (fmt.type?.startsWith('audio/') || fmt.bitrate && !fmt.qualityLabel) {
        if (audioRef.current) {
          audioRef.current.src = fmt.url;
          audioRef.current.currentTime = currentTime;
          if (wasPlaying) audioRef.current.play().catch(() => {});
        }
      } else {
        videoRef.current.src = fmt.url;
        videoRef.current.currentTime = currentTime;
        if (wasPlaying) videoRef.current.play().catch(() => {});
      }
    }
  };

  const toggleOnTheMove = () => {
    const nextState = !isOnTheMove;
    setIsOnTheMove(nextState);

    const video = videoRef.current;
    const audio = audioRef.current;
    const hasAudioTrack = Boolean(
      audio && audio.src && !audio.src.endsWith('/') && audio.src !== window.location.href
    );

    if (nextState) {
      // Activating On The Move: halt video rendering, play audio
      if (hasAudioTrack && audio) {
        audio.currentTime = video?.currentTime || currentTime || 0;
        if (video && !video.paused) {
          video.pause();
        }
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      } else if (video) {
        // If single progressive stream, keep audio playing from video
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      // Deactivating On The Move: restore video visual
      if (hasAudioTrack && audio) {
        if (video) {
          video.currentTime = audio.currentTime;
          if (!audio.paused) {
            video.play().catch(() => {});
          }
        }
      } else if (video) {
        if (video.paused && isPlaying) {
          video.play().catch(() => {});
        }
      }
    }
  };

  const handleDownload = async () => {
    const targetUrl = streamDetails?.bestProgressive?.url || videoRef.current?.src;
    if (!targetUrl || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let receivedBytes = 0;
      const reader = response.body?.getReader();

      if (!reader) {
        const blob = await response.blob();
        saveBlobToDevice(blob);
        return;
      }

      const chunks: BlobPart[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0) {
            const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
            setDownloadProgress(pct);
          } else {
            setDownloadProgress((prev) => Math.min(95, (prev || 0) + 10));
          }
        }
      }

      setDownloadProgress(100);
      const fullBlob = new Blob(chunks, { type: 'video/mp4' });
      saveBlobToDevice(fullBlob);
    } catch (err) {
      console.warn('Binary stream download fallback to direct anchor', err);
      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = `${(streamDetails?.title || 'video').replace(/[/\\?%*:|"<>]/g, '_')}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(null);
      }, 1500);
    }
  };

  const saveBlobToDevice = (blob: Blob) => {
    const cleanName = (streamDetails?.title || 'video')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .slice(0, 50);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${cleanName}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  // Dragging & Pinch state for mini-player
  const modalRef = useRef<HTMLDivElement | null>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const isPinchingRef = useRef(false);
  const hasMovedRef = useRef(false);

  // Likes state
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [isChannelSubscribed, setIsChannelSubscribed] = useState(false);

  // Reset mini player transform when opening or restoring
  useEffect(() => {
    if (!isMiniPlayer) {
      setDragPos({ x: 0, y: 0 });
      dragPosRef.current = { x: 0, y: 0 };
      setScale(1);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMiniPlayer, isOpen]);

  // Controls auto-hide
  const triggerControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      triggerControls();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying, triggerControls]);

  // Aspect ratio and Fullscreen state
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = Boolean(document.fullscreenElement);
      setIsFullscreen(isFS);
      if (!isFS) {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Fullscreen toggle with landscape screen orientation lock
  const toggleFullscreen = useCallback(() => {
    const el = document.getElementById('playerContainer');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => {
          if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
            (screen.orientation as any).lock('landscape').catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Picture-in-Picture (PiP) state & handler
  const [isPiPActive, setIsPiPActive] = useState(false);

  useEffect(() => {
    const handleEnterPiP = () => setIsPiPActive(true);
    const handleLeavePiP = () => setIsPiPActive(false);

    document.addEventListener('enterpictureinpicture', handleEnterPiP);
    document.addEventListener('leavepictureinpicture', handleLeavePiP);
    return () => {
      document.removeEventListener('enterpictureinpicture', handleEnterPiP);
      document.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  const togglePiP = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current && document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP request failed', err);
    }
  }, [videoRef]);

  // Long press 2x playback speed state & handlers
  const [is2xSpeed, setIs2xSpeed] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const start2xSpeed = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.playbackRate = 2.0;
      if (audioRef.current) audioRef.current.playbackRate = 2.0;
      setIs2xSpeed(true);
    }
  };

  const stop2xSpeed = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (is2xSpeed && videoRef.current) {
      videoRef.current.playbackRate = 1.0;
      if (audioRef.current) audioRef.current.playbackRate = 1.0;
      setIs2xSpeed(false);
    }
  };

  // Double tap seek feedback (-10s / +10s)
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [seekFeedback, setSeekFeedback] = useState<'left' | 'right' | null>(null);
  const seekFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mini player touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMiniPlayer) return;
    hasMovedRef.current = false;

    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - dragPosRef.current.x,
        y: e.touches[0].clientY - dragPosRef.current.y
      };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      isPinchingRef.current = true;
      initialPinchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMiniPlayer) return;

    if (isDraggingRef.current && e.touches.length === 1) {
      hasMovedRef.current = true;
      const newX = e.touches[0].clientX - dragStartRef.current.x;
      const newY = e.touches[0].clientY - dragStartRef.current.y;
      dragPosRef.current = { x: newX, y: newY };
      setDragPos({ x: newX, y: newY });
    } else if (e.touches.length === 2 && initialPinchDistRef.current) {
      hasMovedRef.current = true;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialPinchDistRef.current;
      const newScale = Math.min(Math.max(factor * scale, 0.8), 1.3);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    if (!isMiniPlayer) return;
    isDraggingRef.current = false;
    isPinchingRef.current = false;
    initialPinchDistRef.current = null;

    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    const padding = 12;
    let targetX = dragPosRef.current.x;
    let targetY = dragPosRef.current.y;

    if (rect.left < window.innerWidth / 2) {
      targetX = targetX - (rect.left - padding);
    } else {
      targetX = targetX + (window.innerWidth - rect.right - padding);
    }

    if (rect.top < padding) {
      targetY = targetY + (padding - rect.top);
    } else if (rect.bottom > window.innerHeight - 70) {
      targetY = targetY - (rect.bottom - (window.innerHeight - 70));
    }

    dragPosRef.current = { x: targetX, y: targetY };
    setDragPos({ x: targetX, y: targetY });
  };

  // Mouse drag handlers for desktop support
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMiniPlayer) return;
    if ((e.target as HTMLElement).closest('button')) return;
    hasMovedRef.current = false;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - dragPosRef.current.x,
      y: e.clientY - dragPosRef.current.y
    };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!isDraggingRef.current) return;
      hasMovedRef.current = true;
      const newX = moveEv.clientX - dragStartRef.current.x;
      const newY = moveEv.clientY - dragStartRef.current.y;
      dragPosRef.current = { x: newX, y: newY };
      setDragPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) return null;

  return (
    <div
      id="videoModal"
      ref={modalRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={
        isMiniPlayer
          ? {
              transform: `translate(${dragPos.x}px, ${dragPos.y}px) scale(${scale})`,
              transformOrigin: 'bottom right'
            }
          : undefined
      }
      className={`fixed transition-all duration-300 z-50 bg-black flex flex-col select-none ${
        isMiniPlayer
          ? 'mini-player-active shadow-2xl border border-white/20'
          : 'inset-0'
      }`}
    >


      {/* Player Stage Container with Taller Height & Overlay Controls */}
      <div
        id="playerContainer"
        style={
          !isMiniPlayer && !isFullscreen && videoAspectRatio
            ? { aspectRatio: `${videoAspectRatio}`, maxHeight: '72vh' }
            : undefined
        }
        onPointerDown={() => {
          if (!isMiniPlayer) {
            longPressTimerRef.current = setTimeout(() => {
              start2xSpeed();
            }, 350);
          }
        }}
        onPointerUp={stop2xSpeed}
        onPointerLeave={stop2xSpeed}
        onTouchCancel={stop2xSpeed}
        onClick={(e) => {
          if (isMiniPlayer) {
            if (!hasMovedRef.current) {
              restoreFullscreen();
            }
            return;
          }
          if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
            return;
          }

          const now = Date.now();
          const clientX = e.clientX;
          const container = document.getElementById('playerContainer');
          const rect = container?.getBoundingClientRect();

          if (rect && now - lastTapRef.current.time < 300) {
            // Double tap detected!
            const relativeX = clientX - rect.left;
            const width = rect.width;

            if (relativeX < width * 0.4) {
              // Left side double tap: -10s
              skip(-10);
              setSeekFeedback('left');
            } else if (relativeX > width * 0.6) {
              // Right side double tap: +10s
              skip(10);
              setSeekFeedback('right');
            }

            if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);
            seekFeedbackTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 850);
            lastTapRef.current = { time: 0, x: 0 };
            return;
          }

          lastTapRef.current = { time: now, x: clientX };

          setShowControls(prev => !prev);
          if (!showControls) triggerControls();
        }}
        className={`relative w-full aspect-[4/5] sm:aspect-video bg-black flex items-center justify-center group overflow-hidden ${
          isMiniPlayer ? 'cursor-pointer h-full' : ''
        }`}
      >
        {/* 2x Playback Speed Hold Overlay Indicator */}
        {is2xSpeed && (
          <div className="absolute top-4 bg-black/80 border border-butterYellow/50 text-butterYellow font-black text-xs px-3.5 py-1.5 rounded-full flex items-center space-x-1.5 z-40 shadow-2xl animate-pulse backdrop-blur-md">
            <span>2X SPEED</span>
            <FastForward size={16} weight="fill" />
          </div>
        )}

        {/* Double-Tap Seek Ripple Feedback */}
        {seekFeedback === 'left' && (
          <div className="absolute left-10 bg-black/75 text-butterYellow border border-butterYellow/30 font-bold text-xs px-4 py-2 rounded-2xl flex items-center space-x-1.5 z-40 animate-ping shadow-2xl backdrop-blur-md">
            <Rewind size={20} weight="fill" />
            <span>-10s</span>
          </div>
        )}
        {seekFeedback === 'right' && (
          <div className="absolute right-10 bg-black/75 text-butterYellow border border-butterYellow/30 font-bold text-xs px-4 py-2 rounded-2xl flex items-center space-x-1.5 z-40 animate-ping shadow-2xl backdrop-blur-md">
            <span>+10s</span>
            <FastForward size={20} weight="fill" />
          </div>
        )}

        {/* Chevron, PiP & X controls integrated directly into video overlay */}
        {!isMiniPlayer && (
          <div
            id="topVideoControls"
            className={`absolute top-0 inset-x-0 flex justify-between items-center px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white z-30 transition-opacity duration-300 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                minimizePlayer();
              }}
              className="p-2 text-2xl active:opacity-60 focus:outline-none cursor-pointer text-white drop-shadow-md"
              aria-label="Minimize video player"
            >
              <CaretDown size={24} weight="bold" />
            </button>
            <div className="flex space-x-4 text-xl items-center">
              {document.pictureInPictureEnabled && (
                <button
                  onClick={togglePiP}
                  className={`p-1.5 active:opacity-60 cursor-pointer drop-shadow-md transition-colors ${
                    isPiPActive ? 'text-butterYellow' : 'text-white hover:text-butterYellow'
                  }`}
                  aria-label="Toggle Picture in Picture"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture size={22} weight="bold" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeVideo();
                }}
                className="p-1 active:opacity-60 cursor-pointer text-white drop-shadow-md"
                aria-label="Close video player"
              >
                <X size={24} weight="bold" />
              </button>
            </div>
          </div>
        )}
        {/* On The Move (Music Mode) Audio Stage Overlay */}
        {isOnTheMove && (
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-gray-950 via-black to-gray-950 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none">
            <div className="relative mb-4">
              <img
                src={
                  streamDetails?.thumbnails?.[0]?.url ||
                  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80'
                }
                alt={streamDetails?.title}
                className="w-24 h-24 rounded-2xl object-cover ring-2 ring-butterYellow/50 shadow-2xl"
              />
              <div className="absolute -bottom-2 -right-2 bg-butterYellow text-black text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                <span>ON THE MOVE</span>
              </div>
            </div>

            <h3 className="text-sm font-bold text-white max-w-xs truncate">
              {streamDetails?.title || 'Audio Stream'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {streamDetails?.author || 'Artist'}
            </p>

            {/* Equalizer Waveform Animation */}
            <div className="flex items-center space-x-1 mt-4 h-6">
              {[40, 75, 100, 60, 90, 45, 80, 60, 30].map((h, i) => (
                <div
                  key={i}
                  style={{
                    height: isPlaying ? `${h}%` : '20%',
                    transition: 'height 0.2s ease-in-out'
                  }}
                  className="w-1 bg-butterYellow rounded-full"
                />
              ))}
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          id="htmlVideoPlayer"
          className={`w-full h-full object-contain pointer-events-none transition-opacity duration-300 ${
            isOnTheMove ? 'opacity-0' : 'opacity-100'
          }`}
          playsInline
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (!v.duration || isNaN(v.duration)) return;

            // Enforce 10-minute free preview limit for unsubscribed users
            if (!hasActiveSub && v.currentTime >= FREE_PREVIEW_LIMIT) {
              v.currentTime = FREE_PREVIEW_LIMIT;
              if (!v.paused) v.pause();
              if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
              setCurrentTime(FREE_PREVIEW_LIMIT);
              setIsPlaying(false);
              setIsPreviewLimitReached(true);
              return;
            }

            if (v.currentTime < FREE_PREVIEW_LIMIT && isPreviewLimitReached) {
              setIsPreviewLimitReached(false);
            }

            if (!isOnTheMove) {
              setCurrentTime(v.currentTime);
              setDuration(v.duration);
              setProgress((v.currentTime / v.duration) * 100);
            }
          }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.duration && !isNaN(v.duration)) {
              setDuration(v.duration);
            }
            if (v.videoWidth && v.videoHeight) {
              setVideoAspectRatio(v.videoWidth / v.videoHeight);
            }
          }}
          onCanPlay={(e) => {
            const v = e.currentTarget;
            if (!isOnTheMove && (activeDirectUrl || (streamDetails && streamDetails.authorId === 'popcorn'))) {
              v.muted = false;
              v.volume = 1.0;
            }
          }}
          onDurationChange={(e) => {
            const v = e.currentTarget;
            if (v.duration && !isNaN(v.duration)) {
              setDuration(v.duration);
            }
          }}
          onWaiting={() => {
            if (!isOnTheMove) setIsBuffering(true);
          }}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPlay={() => {
            setIsPlaying(true);
          }}
          onPause={() => {
            if (!isOnTheMove) setIsPlaying(false);
          }}
          onSeeking={(e) => {
            if (!isOnTheMove && audioRef.current?.src) {
              audioRef.current.currentTime = e.currentTarget.currentTime;
            }
          }}
          onSeeked={(e) => {
            if (!isOnTheMove && audioRef.current?.src) {
              audioRef.current.currentTime = e.currentTarget.currentTime;
            }
          }}
          onError={() => {
            if (videoRef.current && !videoRef.current.src.includes('TearsOfSteel')) {
              videoRef.current.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
              videoRef.current.load();
              videoRef.current.play().catch(() => {});
            }
          }}
        />
        <audio
          ref={audioRef}
          className="hidden"
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            if (!a.duration || isNaN(a.duration)) return;

            // Enforce 10-minute free preview limit for unsubscribed users
            if (!hasActiveSub && a.currentTime >= FREE_PREVIEW_LIMIT) {
              a.currentTime = FREE_PREVIEW_LIMIT;
              if (!a.paused) a.pause();
              if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
              setCurrentTime(FREE_PREVIEW_LIMIT);
              setIsPlaying(false);
              setIsPreviewLimitReached(true);
              return;
            }

            if (isOnTheMove) {
              setCurrentTime(a.currentTime);
              setDuration(a.duration);
              setProgress((a.currentTime / a.duration) * 100);
            }
          }}
          onLoadedMetadata={(e) => {
            if (isOnTheMove) {
              const a = e.currentTarget;
              if (a.duration && !isNaN(a.duration)) {
                setDuration(a.duration);
              }
            }
          }}
          onWaiting={() => {
            setIsBuffering(true);
          }}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPlay={() => {
            setIsPlaying(true);
          }}
          onPause={() => {
            if (isOnTheMove) {
              setIsPlaying(false);
            }
          }}
        />

        {/* 10-Minute Limit Reached: Flat Pill at the bottom center */}
        {(!hasActiveSub && (currentTime >= FREE_PREVIEW_LIMIT || isPreviewLimitReached)) && (
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-40 px-4 pointer-events-auto animate-fadeIn">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenSubscriptionFlow();
              }}
              className="px-6 py-2.5 bg-[#E5C058] hover:bg-[#edd06f] text-black font-extrabold text-xs sm:text-sm tracking-wide rounded-full shadow-[0_4px_25px_rgba(229,192,88,0.45)] border border-[#E5C058] flex items-center space-x-2 active:scale-95 transition-all cursor-pointer select-none"
            >
              <span>Unlimited access</span>
              <LockOpen size={18} weight="fill" className="text-black" />
            </button>
          </div>
        )}

        {/* Mini player overlay quick badge / close */}
        {isMiniPlayer && (
          <div className="absolute inset-0 bg-black/20 hover:bg-black/40 transition-colors flex items-start justify-between p-1.5 pointer-events-auto">
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restoreFullscreen();
                }}
                className="text-white/90 bg-black/60 rounded-full p-1 hover:text-butterYellow cursor-pointer"
                title="Expand"
              >
                <CornersOut size={14} weight="bold" />
              </button>
              {document.pictureInPictureEnabled && (
                <button
                  onClick={togglePiP}
                  className="text-white/90 bg-black/60 rounded-full p-1 hover:text-butterYellow cursor-pointer"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture size={14} weight="bold" />
                </button>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeVideo();
              }}
              className="text-white/90 bg-black/60 rounded-full p-1 hover:text-red-400 cursor-pointer"
              title="Close"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        )}

        {/* Custom Overlay Player Controls (Only when not mini-player) */}
        {!isMiniPlayer && (
          <div
            id="playerControls"
            className={`absolute inset-0 bg-black/40 flex flex-col justify-between p-4 transition-opacity duration-200 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex justify-end" />

            {/* Center Play/Pause & Skip Buttons */}
            <div className="flex items-center justify-center space-x-8 text-white">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skip(-10);
                  triggerControls();
                }}
                className="text-3xl active:scale-90 transition-transform cursor-pointer"
                aria-label="Rewind 10 seconds"
              >
                <Rewind size={32} weight="fill" />
              </button>

              <button
                id="modalPlayBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause(isOnTheMove);
                  triggerControls();
                }}
                className="w-14 h-14 bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-3xl text-butterYellow active:scale-95 transition-transform cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoadingStream || isBuffering ? (
                  <SpinnerGap size={28} weight="fill" className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={28} weight="fill" />
                ) : (
                  <Play size={28} weight="fill" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skip(10);
                  triggerControls();
                }}
                className="text-3xl active:scale-90 transition-transform cursor-pointer"
                aria-label="Fast forward 10 seconds"
              >
                <FastForward size={32} weight="fill" />
              </button>
            </div>

            {/* Bottom Progress Bar & Time Details */}
            <div className="flex flex-col space-y-1">
              <input
                type="range"
                id="progressBar"
                value={isNaN(progress) ? 0 : progress}
                min="0"
                max="100"
                step="0.1"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!hasActiveSub && duration > 0) {
                    const maxAllowedPct = (FREE_PREVIEW_LIMIT / duration) * 100;
                    if (val >= maxAllowedPct) {
                      seek(maxAllowedPct);
                      setIsPreviewLimitReached(true);
                      triggerControls();
                      return;
                    }
                  }
                  seek(val);
                  triggerControls();
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full accent-butterYellow h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between items-center text-xs text-white/80 font-mono mt-1">
                <span id="currentTime">{formatTime(currentTime)}</span>
                <div className="flex items-center space-x-3">
                  <span id="duration">{formatTime(duration || streamDetails?.lengthSeconds || 0)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="text-lg text-white hover:text-butterYellow cursor-pointer"
                    aria-label="Toggle fullscreen"
                  >
                    {isFullscreen ? (
                      <CornersIn size={18} weight="bold" />
                    ) : (
                      <CornersOut size={18} weight="bold" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Information & Interaction Details (Scrollable content below player) */}
      {!isMiniPlayer && (
        <div
          id="modalScrollableContent"
          className="flex-1 overflow-y-auto p-4 text-white bg-black/95 no-scrollbar"
        >
          {isLoadingStream ? (
            <div className="animate-pulse space-y-4 py-2">
              <div className="h-5 bg-white/10 rounded-lg w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/3" />
              <div className="flex items-center justify-between py-3 border-y border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-white/10" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-white/10 rounded w-28" />
                    <div className="h-2 bg-white/10 rounded w-16" />
                  </div>
                </div>
                <div className="w-20 h-7 bg-white/10 rounded-full" />
              </div>
              <div className="flex space-x-3 overflow-x-auto py-2 no-scrollbar">
                <div className="w-28 h-8 bg-white/10 rounded-full flex-shrink-0" />
                <div className="w-20 h-8 bg-white/10 rounded-full flex-shrink-0" />
                <div className="w-24 h-8 bg-white/10 rounded-full flex-shrink-0" />
              </div>
            </div>
          ) : (
            <>
              <h2 id="modalVideoTitle" className="text-base font-bold leading-snug">
                {errorMessage
                  ? 'Unable to load stream'
                  : streamDetails?.title || 'Video Title'}
              </h2>

              <p id="modalVideoMeta" className="text-xs text-gray-400 mt-1">
                {streamDetails?.authorId === 'popcorn' ? (
                  <span>{streamDetails.publishedText || '2026'} • 1080p HD</span>
                ) : streamDetails ? (
                  `${(streamDetails.viewCount / 1000).toFixed(0)}K views • ${
                    streamDetails.publishedText || 'Recently'
                  }`
                ) : errorMessage ? (
                  errorMessage
                ) : (
                  'Metadata'
                )}
              </p>

              {/* Channel Header & Subscribe Button (Only for non-Popcorn YouTube items) */}
              {streamDetails?.authorId !== 'popcorn' && (
                <div className="flex items-center justify-between mt-4 py-3 border-y border-white/10">
                  <div className="flex items-center space-x-3">
                    <img
                      id="modalChannelAvatar"
                      src={
                        streamDetails?.authorThumbnails?.[0]?.url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(streamDetails?.author || 'Channel')}&background=111&color=fff&bold=true`
                      }
                      alt="Channel Avatar"
                      className="w-9 h-9 rounded-full object-cover border border-white/10"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(streamDetails?.author || 'Channel')}&background=111&color=fff&bold=true`;
                      }}
                    />
                    <div>
                      <h4 id="modalChannelName" className="text-sm font-semibold">
                        {streamDetails?.author || 'Official Channel'}
                      </h4>
                      <span className="text-xs text-gray-400">Official Partner</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsChannelSubscribed(!isChannelSubscribed)}
                    className={`${
                      isChannelSubscribed ? 'bg-gray-700 text-white' : 'bg-white text-black'
                    } text-xs font-semibold px-4 py-2 rounded-full active:opacity-80 cursor-pointer transition-colors`}
                  >
                    {isChannelSubscribed ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* YouTube Minimalist Action Buttons */}
          <div className="flex items-center space-x-3 overflow-x-auto py-4 no-scrollbar">
            <button
              onClick={toggleOnTheMove}
              className={`flex items-center space-x-1.5 rounded-full text-xs font-medium px-4 py-2 flex-shrink-0 transition-all ${
                isOnTheMove
                  ? 'border-[0.5px] border-butterYellow text-butterYellow bg-butterYellow/10 shadow-[0_0_12px_rgba(229,192,88,0.25)] cursor-pointer'
                  : 'bg-transparent text-white/90 border-[0.5px] border-white/30 hover:border-white cursor-pointer'
              }`}
            >
              <span>
                {isOnTheMove 
                  ? (!isAudioReady ? `Syncing Audio (${audioDownloadProgress}%)` : 'On the move (Audio)')
                  : (!isAudioReady && audioDownloadProgress !== null ? `Syncing (${audioDownloadProgress}%)` : 'On the move')
                }
              </span>
            </button>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: streamDetails?.title || 'Popcorn Video',
                    url: window.location.href
                  }).catch(() => {});
                }
              }}
              className="flex items-center space-x-1 bg-white/10 rounded-full text-xs font-medium px-4 py-2 flex-shrink-0 active:opacity-60 cursor-pointer hover:bg-white/15"
            >
              <ShareNetwork size={16} weight="bold" />
              <span>Share</span>
            </button>

            {/* HD Toggle Button (Only for split-stream YouTube videos) */}
            {streamDetails?.adaptiveVideo && streamDetails.adaptiveVideo.length > 0 && (
              <button
                onClick={() => setHDMode(!isHDMode)}
                className={`flex items-center space-x-1.5 rounded-full text-[10px] font-extrabold px-3 py-2 flex-shrink-0 transition-all border ${
                  isHDMode 
                  ? 'bg-butterYellow text-black border-butterYellow shadow-[0_0_10px_rgba(229,192,88,0.3)]' 
                  : 'bg-white/5 text-white/50 border-white/10 hover:border-white/30'
                }`}
              >
                <span>1080p HD</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 rounded-full text-xs font-medium px-4 py-2 flex-shrink-0 active:opacity-60 cursor-pointer transition-colors"
            >
              {isDownloading ? (
                <SpinnerGap size={16} weight="bold" className="animate-spin text-butterYellow" />
              ) : (
                <DownloadSimple size={16} weight="bold" />
              )}
              <span>
                {isDownloading
                  ? downloadProgress !== null
                    ? `${downloadProgress}%`
                    : 'Downloading...'
                  : 'Download'}
              </span>
            </button>

            <button
              onClick={() => {
                if (currentVideoId && streamDetails) {
                  const currentItem = {
                    id: currentVideoId,
                    videoId: currentVideoId,
                    title: streamDetails.title,
                    channelName: streamDetails.author,
                    channelId: streamDetails.authorId,
                    views: `${(streamDetails.viewCount / 1000).toFixed(0)}K views`,
                    viewCount: streamDetails.viewCount,
                    timestamp: streamDetails.publishedText || 'Recently',
                    duration: '2:30',
                    lengthSeconds: streamDetails.lengthSeconds,
                    likes: '45K',
                    thumbnail: streamDetails.thumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80',
                    avatar: streamDetails.authorThumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
                  };
                  toggleWatchlist(currentItem);
                }
              }}
              className={`flex items-center space-x-1.5 rounded-full text-xs font-medium px-4 py-2 flex-shrink-0 active:opacity-60 cursor-pointer transition-colors ${
                currentVideoId && isInWatchlist(currentVideoId)
                  ? 'bg-butterYellow text-black font-semibold'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              <BookmarkSimple size={16} weight={currentVideoId && isInWatchlist(currentVideoId) ? 'fill' : 'bold'} />
              <span>{currentVideoId && isInWatchlist(currentVideoId) ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          {/* Unconfined Episodes & Downloads Section */}
          {streamDetails?.downloads && streamDetails.downloads.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <DownloadSimple size={17} weight="bold" className="text-butterYellow" />
                  <span>Episodes & Downloads ({streamDetails.downloads.length})</span>
                </h3>
                <span className="text-[11px] font-semibold text-butterYellow bg-butterYellow/10 px-2.5 py-0.5 rounded-full border border-butterYellow/20">
                  1080p
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {streamDetails.downloads.map((dl, idx) => {
                  const isActive = activeDirectUrl === dl.url;
                  const epMatch = dl.label.match(/Episode\s*(\d+)/i) || dl.label.match(/E(\d+)/i);
                  const epNum = epMatch ? parseInt(epMatch[1], 10) : idx + 1;
                  // First episode (Episode 1 / idx === 0) allows first 10 minutes free preview.
                  // All subsequent episodes (Episode 2, 3...) are strictly disabled with padlock.
                  const isEpisodeLocked = !hasActiveSub && (epNum > 1 || idx > 0);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (isEpisodeLocked) {
                          handleOpenSubscriptionFlow();
                          return;
                        }
                        playDirectUrl(dl.url, dl.label, idx);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all select-none ${
                        isEpisodeLocked
                          ? 'bg-white/[0.02] border-white/10 opacity-75 hover:opacity-100 hover:border-[#E5C058]/40 cursor-pointer'
                          : isActive
                          ? 'bg-butterYellow/15 border-butterYellow/50 shadow-[0_0_15px_rgba(229,192,88,0.1)] cursor-pointer'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          isEpisodeLocked
                            ? 'bg-[#E5C058]/10 text-[#E5C058] border border-[#E5C058]/30'
                            : isActive 
                            ? 'bg-butterYellow text-black' 
                            : 'bg-butterYellow/10 text-butterYellow group-hover:bg-butterYellow group-hover:text-black'
                        }`}>
                          {isEpisodeLocked ? (
                            <Lock size={16} weight="fill" />
                          ) : (
                            <Play size={16} weight="fill" className="ml-0.5" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            <span className={`text-xs font-semibold truncate transition-colors ${
                              isEpisodeLocked
                                ? 'text-gray-300'
                                : isActive 
                                ? 'text-butterYellow font-bold' 
                                : 'text-white'
                            }`}>
                              {dl.label}
                            </span>
                            {isActive && (
                              <span className="bg-butterYellow text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-tighter animate-pulse">
                                Playing
                              </span>
                            )}
                            {isEpisodeLocked ? (
                              <span className="bg-[#E5C058]/20 text-[#E5C058] border border-[#E5C058]/40 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider flex items-center space-x-0.5">
                                <Lock size={9} weight="fill" />
                                <span>LOCKED</span>
                              </span>
                            ) : (!hasActiveSub && (epNum === 1 || idx === 0)) ? (
                              <span className="bg-butterYellow/10 text-butterYellow border border-butterYellow/30 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                                10m Preview
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            {dl.size_human} • {dl.quality || 'Direct'} {isEpisodeLocked ? '• VIP Subscription required' : ''}
                          </span>
                        </div>
                      </div>

                      {isEpisodeLocked ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSubscriptionFlow();
                          }}
                          className="px-2 py-1 rounded-lg bg-[#E5C058]/15 border border-[#E5C058]/35 hover:bg-[#E5C058] text-[#E5C058] hover:text-black flex items-center space-x-1 transition-all text-[10px] font-extrabold cursor-pointer flex-shrink-0"
                          title="Locked - Click to unlock with VIP"
                        >
                          <Lock size={12} weight="fill" />
                          <span>Unlock</span>
                        </button>
                      ) : (
                        <a
                          href={dl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-all flex-shrink-0"
                          title="Download"
                        >
                          <DownloadSimple size={16} weight="bold" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Up Next / Recommended Header */}
          <div className="mt-4 pb-8">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Up Next</h3>
            <div id="upNextFeed" className="flex flex-col space-y-4">
              {streamDetails?.recommended && streamDetails.recommended.length > 0 ? (
                streamDetails.recommended.slice(0, 8).map((rec: any, idx: number) => {
                  const item = normalizeItem(rec);
                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => openVideo(item.id)}
                      className="flex space-x-3 cursor-pointer active:opacity-80 group"
                    >
                      <div className="relative w-36 aspect-video bg-gray-800 flex-shrink-0 overflow-hidden rounded-sm">
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded-sm">
                          {item.duration || '2:30'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {item.channelName}
                        </p>
                        <p className="text-[10px] text-gray-500">{item.views}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col space-y-3 py-2 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex space-x-3">
                      <div className="w-36 aspect-video bg-white/10 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-white/10 rounded w-full" />
                        <div className="h-2.5 bg-white/10 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      )}

      {/* Subscription Checkout Modal */}
      <SubscriptionCheckoutModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={async () => {
          setIsPreviewLimitReached(false);
          await refreshSubscription();
        }}
      />

      {/* Sign In / Register Prompt Modal for Unauthenticated Users */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          setShowSubscriptionModal(true);
        }}
      />
    </div>
  );
};
