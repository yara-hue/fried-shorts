"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Load the YouTube IFrame API exactly once across the app. */
function loadYouTubeAPI(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}

type State = {
  duration: number | null;
  detecting: boolean;
  error: string | null;
};

/**
 * Detects a YouTube video's duration (in seconds) client-side using the
 * official IFrame Player API. A tiny, muted, off-screen player is created,
 * its metadata is read via getDuration(), and it is destroyed immediately.
 *
 * This is the most reliable way to read length without a Data API key, since
 * YouTube gates the watch page HTML for server-side scrapers.
 */
export function useYouTubeDuration(videoId: string | null): State {
  const [duration, setDuration] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!videoId) {
      setDuration(null);
      setDetecting(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setDuration(null);
    setError(null);
    setDetecting(true);

    function cleanup() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    }

    loadYouTubeAPI()
      .then(() => {
        if (cancelled || !window.YT || !window.YT.Player) {
          if (!cancelled) {
            setDetecting(false);
            setError("Player library unavailable.");
          }
          return;
        }

        // Reuse a single off-screen container.
        if (!containerRef.current) {
          const c = document.createElement("div");
          c.setAttribute("data-yt-duration-probe", "true");
          c.style.cssText =
            "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
          document.body.appendChild(c);
          containerRef.current = c;
        }
        containerRef.current.innerHTML = "";
        const el = document.createElement("div");
        el.style.width = "1px";
        el.style.height = "1px";
        containerRef.current.appendChild(el);

        let resolved = false;

        playerRef.current = new window.YT.Player(el, {
          videoId,
          width: "1",
          height: "1",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: () => {
              const tryRead = (): number => {
                const d = playerRef.current?.getDuration?.();
                return typeof d === "number" && d > 0 ? d : 0;
              };

              // Immediate attempt (works for most cued videos).
              const immediate = tryRead();
              if (immediate > 0 && !cancelled && !resolved) {
                resolved = true;
                setDuration(immediate);
                setDetecting(false);
                cleanup();
                return;
              }

              // Fallback: briefly buffer the (muted) video so metadata loads,
              // then read the duration and pause. Muted => no audible audio.
              try {
                playerRef.current?.mute?.();
                playerRef.current?.playVideo?.();
              } catch {
                /* ignore */
              }

              let tries = 0;
              pollRef.current = setInterval(() => {
                tries++;
                const d = tryRead();
                if (d > 0 && !resolved) {
                  resolved = true;
                  if (!cancelled) {
                    setDuration(d);
                    setDetecting(false);
                  }
                  try {
                    playerRef.current?.pauseVideo?.();
                  } catch {
                    /* ignore */
                  }
                  cleanup();
                } else if (tries > 40) {
                  // ~4s budget
                  if (!cancelled && !resolved) {
                    setDetecting(false);
                    setError("Could not auto-detect length.");
                  }
                  cleanup();
                }
              }, 100);
            },
            onError: () => {
              if (!cancelled) {
                setDetecting(false);
                setError("This video can't be embedded for length detection.");
              }
              cleanup();
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDetecting(false);
          setError("Failed to load the YouTube player.");
        }
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [videoId]);

  return { duration, detecting, error };
}
