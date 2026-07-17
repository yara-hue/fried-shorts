import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, type VideoInfo } from "@/lib/youtube";

export const runtime = "nodejs";

/**
 * Fetch lightweight oEmbed metadata (title, author, thumbnail).
 *
 * NOTE on duration: YouTube no longer exposes video length in server-side
 * requests without an API key (the watch page returns a gated/consent page).
 * Duration is therefore detected client-side via the official YouTube IFrame
 * Player API (see src/hooks/use-youtube-duration.ts), and the user can always
 * override it manually. The `duration` field here is kept for the response
 * shape but is always null from this endpoint.
 */
async function fetchOEmbed(videoId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl
  )}&format=json`;
  const res = await fetch(oembedUrl, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
}

export async function POST(req: NextRequest) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const url = typeof body.url === "string" ? body.url : "";
  const videoId = extractVideoId(url);

  if (!videoId) {
    return NextResponse.json(
      { error: "Could not find a valid YouTube video ID in that link." },
      { status: 400 }
    );
  }

  const oembed = await fetchOEmbed(videoId).catch(() => null);

  if (!oembed) {
    return NextResponse.json(
      {
        error:
          "Could not load this video. It may be private, age-restricted, or unavailable for embedding.",
      },
      { status: 404 }
    );
  }

  const info: VideoInfo = {
    videoId,
    title: oembed.title ?? "Untitled video",
    author: oembed.author_name ?? "Unknown",
    thumbnail:
      oembed.thumbnail_url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: null,
    durationLabel: null,
  };

  return NextResponse.json(info);
}
