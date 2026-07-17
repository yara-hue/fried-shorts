/** Shared YouTube helpers used by both the API route and the client UI. */

export type VideoInfo = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number | null; // seconds
  durationLabel: string | null;
};

export type Clip = {
  id: string;
  index: number; // 1-based display number
  start: number; // seconds
  end: number; // seconds
  title: string;
};

/** Extract the 11-char YouTube video id from many URL shapes. */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:music\.youtube\.com\/watch\?[^#]*?v=)([a-zA-Z0-9_-]{11})/,
  ];

  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1];
  }

  try {
    const u = new URL(raw);
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  } catch {
    /* ignore */
  }

  return null;
}

export function formatDuration(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Build a YouTube embed URL that plays a specific [start, end] segment. */
export function buildEmbedUrl(
  videoId: string,
  start: number,
  end: number,
  opts: { autoplay?: boolean } = {}
): string {
  const params = new URLSearchParams({
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    color: "white",
    enablejsapi: "1",
  });
  if (opts.autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** A shareable watch link that jumps to the clip start. */
export function buildShareUrl(videoId: string, start: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(start)}s`;
}

export function formatStamp(seconds: number): string {
  return formatDuration(seconds);
}
