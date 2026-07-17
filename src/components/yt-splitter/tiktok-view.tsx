"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Copy,
  Trash2,
  Share2,
  Check,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Loader2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildShareUrl,
  formatStamp,
  type Clip,
} from "@/lib/youtube";

type FitMode = "fill" | "fit";
type PlayerMap = Record<string, any>;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYTAPI(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve();
    if (!document.getElementById("yt-tiktok-api")) {
      const s = document.createElement("script");
      s.id = "yt-tiktok-api";
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return apiPromise;
}

/** How many clips on each side of the active one to keep players alive for. */
const PRELOAD_WINDOW = 1;

export function TikTokView({
  clips,
  videoId,
  fitMode,
  onClose,
  onDelete,
  onCopy,
}: {
  clips: Clip[];
  videoId: string;
  fitMode: FitMode;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playersRef = useRef<PlayerMap>({});
  const playerElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeStr, setTimeStr] = useState("");
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState<Set<string>>(new Set());
  const [playerReady, setPlayerReady] = useState<Set<string>>(new Set());
  const [userInteracted, setUserInteracted] = useState(false);
  const isScrolling = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerCreationQueue = useRef<Set<string>>(new Set());
  const activeIndexRef = useRef(0);

  // Keep ref in sync with state so callbacks always see latest value
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const currentClip = clips[activeIndex];
  const dur = currentClip ? Math.max(0, currentClip.end - currentClip.start) : 0;

  // Which indices should have a live player right now
  const visibleIndices = getVisibleIndices(activeIndex, clips.length);

  // ─── Load YT API and create initial players ──────────────────────────
  useEffect(() => {
    if (clips.length === 0) return;
    let cancelled = false;

    loadYTAPI().then(() => {
      if (cancelled) return;
      const YT = window.YT;
      if (!YT?.Player) return;
      ensurePlayers(YT, getVisibleIndices(0, clips.length));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.length]);

  // ─── When activeIndex changes, create/destroy players ────────────────
  useEffect(() => {
    const YT = window.YT;
    if (!YT?.Player) return;

    ensurePlayers(YT, visibleIndices);
    destroyDistantPlayers(visibleIndices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, clips.length]);

  function getVisibleIndices(idx: number, total: number): number[] {
    const indices: number[] = [];
    for (
      let i = Math.max(0, idx - PRELOAD_WINDOW);
      i <= Math.min(total - 1, idx + PRELOAD_WINDOW);
      i++
    ) {
      indices.push(i);
    }
    return indices;
  }

  function ensurePlayers(YT: any, indices: number[]) {
    for (const idx of indices) {
      const clip = clips[idx];
      if (!clip) continue;
      if (playersRef.current[clip.id]) continue;
      if (playerCreationQueue.current.has(clip.id)) continue;

      const el = playerElsRef.current[clip.id];
      if (!el) continue;

      playerCreationQueue.current.add(clip.id);

      try {
        const p = new YT.Player(el, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
          },
          videoId,
          events: {
            onReady: () => {
              playerCreationQueue.current.delete(clip.id);
              // Mute first (muted autoplay always works)
              p.mute();
              p.cueVideoById({
                videoId,
                startSeconds: Math.floor(clip.start),
                endSeconds: Math.floor(clip.end),
              });
              setPlayerReady((prev) => new Set(prev).add(clip.id));

              // If this is the currently active clip, start playing immediately (muted)
              // Use the ref to get the latest activeIndex (avoids stale closure)
              if (idx === activeIndexRef.current) {
                // Small delay to let cueVideoById settle
                setTimeout(() => {
                  try {
                    p.playVideo();
                    setIsPlaying(true);
                  } catch {}
                }, 50);
              }
            },
            onStateChange: (event: any) => {
              const state = event.data;
              // YT.PlayerState: BUFFERING=3, PLAYING=1, PAUSED=2, ENDED=0, CUED=5
              if (state === 3) {
                setBuffering((prev) => new Set(prev).add(clip.id));
              } else {
                setBuffering((prev) => {
                  const next = new Set(prev);
                  next.delete(clip.id);
                  return next;
                });
              }
              if (state === 1) {
                // Playing
                if (clip.id === clips[activeIndexRef.current]?.id) {
                  setIsPlaying(true);
                }
              } else if (state === 2) {
                // Paused
                if (clip.id === clips[activeIndexRef.current]?.id) {
                  setIsPlaying(false);
                }
              } else if (state === 0) {
                // Ended — loop the clip
                if (clip.id === clips[activeIndexRef.current]?.id) {
                  try {
                    p.seekTo(Math.floor(clip.start), true);
                    p.playVideo();
                  } catch {}
                }
              }
            },
          },
        });
        playersRef.current[clip.id] = p;
      } catch {
        playerCreationQueue.current.delete(clip.id);
      }
    }
  }

  function destroyDistantPlayers(visibleIndices: number[]) {
    const visibleIds = new Set(
      visibleIndices.map((i) => clips[i]?.id).filter(Boolean)
    );
    const currentPlayerMap = playersRef.current;
    for (const id of Object.keys(currentPlayerMap)) {
      if (!visibleIds.has(id)) {
        try {
          currentPlayerMap[id]?.destroy();
        } catch {}
        delete currentPlayerMap[id];
        setPlayerReady((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }

  // ─── Switch active clip: play/pause ─────────────────────────────────
  useEffect(() => {
    const activeClip = clips[activeIndex];
    if (!activeClip) return;

    const pMap = playersRef.current;

    // Pause all other players
    for (const id of Object.keys(pMap)) {
      if (id === activeClip.id) continue;
      try {
        pMap[id].mute();
        pMap[id].pauseVideo();
      } catch {}
    }

    // Play active clip
    const p = pMap[activeClip.id];
    if (p && playerReady.has(activeClip.id)) {
      try {
        // Always start muted (muted autoplay is guaranteed to work)
        p.mute();
        setIsMuted(true);
        p.seekTo(Math.floor(activeClip.start), true);
        p.playVideo();
        setIsPlaying(true);

        // If user already tapped before, unmute immediately
        if (userInteracted) {
          // Use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            try {
              p.unMute();
              setIsMuted(false);
            } catch {}
          });
        }
      } catch {}
    }

    // Update time ticker
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      try {
        const t = p?.getCurrentTime?.();
        if (t != null) {
          const elapsed = Math.max(0, t - activeClip.start);
          const total = Math.max(0, activeClip.end - activeClip.start);
          setTimeStr(`${formatStamp(elapsed)} / ${formatStamp(total)}`);
        }
      } catch {}
    }, 250);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, playerReady.size]);

  // ─── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      for (const id of Object.keys(playersRef.current)) {
        try {
          playersRef.current[id]?.destroy();
        } catch {}
      }
      playersRef.current = {};
    };
  }, []);

  // ─── Scroll handler ─────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const idx = Math.round(el.scrollTop / el.clientHeight);
        if (idx !== activeIndex && idx >= 0 && idx < clips.length) {
          setActiveIndex(idx);
        }
      }, 50);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [activeIndex, clips.length]);

  const scrollTo = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const i = Math.max(0, Math.min(index, clips.length - 1));
      isScrolling.current = true;
      el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
      setActiveIndex(i);
      setTimeout(() => {
        isScrolling.current = false;
      }, 500);
    },
    [clips.length]
  );

  // ─── Tap to play/pause + unmute (single tap = toggle play, first tap also unmutes) ───
  const handleTap = useCallback(() => {
    setUserInteracted(true);
    const clip = clips[activeIndex];
    if (!clip) return;

    const p = playersRef.current[clip.id];
    if (!p) return;

    try {
      const state = p.getPlayerState?.();
      // YT.PlayerState.PLAYING = 1
      if (state === 1) {
        // Currently playing → pause
        p.pauseVideo();
        setIsPlaying(false);
      } else {
        // Not playing → play and unmute
        p.unMute();
        setIsMuted(false);
        p.playVideo();
        setIsPlaying(true);
      }
    } catch {}
  }, [activeIndex, clips]);

  // ─── Toggle mute/unmute (used by volume button) ─────────────────────
  const toggleMute = useCallback(() => {
    setUserInteracted(true);
    const clip = clips[activeIndex];
    if (!clip) return;
    const p = playersRef.current[clip.id];
    if (!p) return;

    try {
      if (isMuted) {
        p.unMute();
        setIsMuted(false);
      } else {
        p.mute();
        setIsMuted(true);
      }
    } catch {}
  }, [activeIndex, clips, isMuted]);

  // ─── Copy handler ──────────────────────────────────────────────────
  const handleCopy = () => {
    if (!currentClip) return;
    const link = buildShareUrl(videoId, currentClip.start);
    navigator.clipboard?.writeText(link).then(() => {
      setCopiedId(currentClip.id);
      onCopy(link);
      setTimeout(() => setCopiedId(null), 1600);
    });
  };

  // ─── Back handler ──────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    for (const id of Object.keys(playersRef.current)) {
      try {
        playersRef.current[id]?.destroy();
      } catch {}
    }
    playersRef.current = {};
    onClose();
  }, [onClose]);

  // ─── Fullscreen ────────────────────────────────────────────────────
  useEffect(() => {
    const handleFsChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen();
  }, [isFullscreen]);

  // ─── Keyboard nav ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollTo(activeIndex - 1);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollTo(activeIndex + 1);
      }
      if (e.key === "Escape") handleBack();
      if (e.key === " ") {
        e.preventDefault();
        handleTap();
      }
      if (e.key === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, scrollTo, handleBack, handleTap, toggleMute]);

  // ─── Pre-cue next clip ─────────────────────────────────────────────
  useEffect(() => {
    const nextIdx = activeIndex + 1;
    if (nextIdx < clips.length) {
      const nextClip = clips[nextIdx];
      const p = playersRef.current[nextClip.id];
      if (p && playerReady.has(nextClip.id)) {
        try {
          p.cueVideoById({
            videoId,
            startSeconds: Math.floor(nextClip.start),
            endSeconds: Math.floor(nextClip.end),
          });
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, playerReady.size]);

  if (clips.length === 0) return null;

  const isCurrentBuffering = currentClip ? buffering.has(currentClip.id) : false;
  const isCurrentReady = currentClip ? playerReady.has(currentClip.id) : false;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black select-none">
      {/* Scrollable video feed */}
      <div
        ref={scrollRef}
        className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory overscroll-none"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <style>{`
          .tiktok-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {clips.map((clip, index) => {
          const isNearActive = visibleIndices.includes(index);
          const isBuffering = buffering.has(clip.id);
          const isReady = playerReady.has(clip.id);
          const isActive = index === activeIndex;

          return (
            <div
              key={clip.id}
              className="snap-start h-dvh w-full relative flex-shrink-0 overflow-hidden bg-black"
            >
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div
                  className="h-full w-full aspect-[9/16] max-h-full mx-auto relative"
                  style={{
                    objectFit: fitMode === "fill" ? "cover" : "contain",
                  }}
                >
                  {/* YouTube player container — only rendered if near active */}
                  {isNearActive && (
                    <div
                      ref={(el) => {
                        playerElsRef.current[clip.id] = el;
                      }}
                      className="absolute inset-0"
                    />
                  )}

                  {/* Transparent overlay to capture all taps — prevents YT iframe from eating clicks */}
                  {isActive && (
                    <div
                      className="absolute inset-0 z-10"
                      onClick={handleTap}
                      style={{ touchAction: "manipulation" }}
                    />
                  )}

                  {/* Buffering spinner */}
                  {isBuffering && isActive && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <Loader2 className="h-10 w-10 text-white/80 animate-spin" />
                    </div>
                  )}

                  {/* Not-ready loading state */}
                  {!isReady && isActive && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <Loader2 className="h-12 w-12 text-white/80 animate-spin" />
                    </div>
                  )}

                  {/* Paused overlay icon */}
                  {isActive && !isPlaying && isCurrentReady && !isCurrentBuffering && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/40 rounded-full p-4 backdrop-blur-sm transition-opacity">
                        <Play className="h-12 w-12 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed UI overlay */}
      <div className="fixed inset-0 z-30 pointer-events-none">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 px-4 pt-12 pb-4 flex items-start justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors active:scale-90"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 pointer-events-auto">
            <Badge className="rounded-full bg-black/60 text-white backdrop-blur-sm border-0 text-xs font-normal">
              #{currentClip?.index ?? "-"}
            </Badge>
            <Badge className="rounded-full bg-rose-600/80 text-white backdrop-blur-sm border-0 text-xs font-normal">
              {formatStamp(dur)}
            </Badge>
            {/* Mute/unmute button */}
            <button
              type="button"
              onClick={toggleMute}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors active:scale-90"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors active:scale-90"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Time indicator */}
        {timeStr && isCurrentReady && (
          <div className="absolute top-28 left-4">
            <span className="text-white/70 text-xs font-mono drop-shadow-lg bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
              {timeStr}
            </span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-16 bg-gradient-to-t from-black/90 to-transparent">
          <h3 className="text-white font-semibold text-sm drop-shadow-lg line-clamp-2 mb-0.5">
            {currentClip?.title ?? ""}
          </h3>
          <p className="text-white/60 text-xs drop-shadow-lg">
            {currentClip
              ? `${formatStamp(currentClip.start)} → ${formatStamp(currentClip.end)}`
              : ""}
          </p>
        </div>

        {/* Right action buttons */}
        <div className="absolute right-3 bottom-28 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleCopy}
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors active:scale-90"
          >
            {copiedId ? (
              <Check className="h-5 w-5 text-emerald-400" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              currentClip &&
              window.open(buildShareUrl(videoId, currentClip.start), "_blank")
            }
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors active:scale-90"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => currentClip && onDelete(currentClip.id)}
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-red-600/80 transition-colors active:scale-90"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
          {clips.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              className={`pointer-events-auto rounded-full transition-all active:scale-125 ${
                i === activeIndex
                  ? "bg-white w-1.5 h-4"
                  : "bg-white/30 hover:bg-white/50 w-1.5 h-1.5"
              }`}
            />
          ))}
        </div>

        {/* Tap hint — shows until user first interacts */}
        {!userInteracted && isCurrentReady && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-2xl px-6 py-3 backdrop-blur-md animate-pulse">
              <p className="text-white text-sm font-medium">
                Tap to play with sound
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
