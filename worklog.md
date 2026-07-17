# Worklog

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Build a YouTube video splitter that turns a YouTube link into short portrait (9:16) clips for mobile — fully web-based, no downloads.

Work Log:
- Inspected existing Next.js 16 project (shadcn/ui, Tailwind v4, Prisma). Dev server already running on port 3000.
- Created shared lib `src/lib/youtube.ts` with `extractVideoId`, `formatDuration`, `buildEmbedUrl` (start/end segment embeds), `buildShareUrl`, and `Clip`/`VideoInfo` types.
- Built API route `src/app/api/video-info/route.ts` (POST) that fetches YouTube oEmbed metadata (title, author, thumbnail). Server-side watch-page scraping for duration was unreliable (YouTube returns a gated/consent page for server requests), so duration is detected client-side instead.
- Created `src/hooks/use-youtube-duration.ts` — loads the official YouTube IFrame Player API once, creates a tiny muted off-screen player, reads `getDuration()` (with a play+poll fallback), then destroys it. Returns `{ duration, detecting, error }`.
- Built `src/components/yt-splitter/portrait-clip-card.tsx` — a 9:16 phone-style frame with notch, clip-number + duration badges, lazy YouTube embed (thumbnail + play overlay → iframe with `start`/`end`/`autoplay`), editable title & time range, copy-link / open-on-YouTube / delete actions. Supports "fill" (crop sides) and "fit" (letterbox) modes via an aspect-video wrapper.
- Built `src/app/page.tsx` — sticky header, hero with URL input + paste + example buttons, video info card (thumbnail/title/author + auto/manual length badge + portrait-fit toggle), split-settings card (Tabs: by-length slider 5–120s with presets, by-count slider 2–20, generate/add-segment/copy-all/clear), responsive 2→5 column portrait clip grid, and a sticky bottom footer.
- Updated `src/app/layout.tsx` metadata to reflect the app name "ShortSplit".
- Verified end-to-end with Agent Browser:
  - Loaded the 3Blue1Brown talk → duration auto-detected as 18:40 (1120s), 38 clips auto-generated.
  - Played a clip → YouTube embed loaded with `start=0&end=30&autoplay=1`.
  - Fit/Fill toggle and By-length/By-count tabs both work; "Generate 6 clips" produced exactly 6 cards.
  - Mobile (390px): 2-column grid, no horizontal overflow.
  - Footer sticks to viewport bottom on short pages; pushed down naturally on long pages.
  - Lo-fi livestream degrades gracefully: detection times out (~4s), shows "Unknown length" + manual-input prompt.
  - No console errors; `bun run lint` clean.

Stage Summary:
- Delivered a complete, browser-only YouTube → portrait-shorts splitter at `/`.
- Key architectural decision: since YouTube blocks server-side duration scraping, duration is read client-side via the IFrame Player API (`getDuration()`), with a manual mm:ss override fallback.
- Clips are "virtual segments" rendered through YouTube embeds with `start`/`end` params — no video files are downloaded or re-encoded (ToS-friendly, truly web-only).
- Files produced: `src/lib/youtube.ts`, `src/app/api/video-info/route.ts`, `src/hooks/use-youtube-duration.ts`, `src/components/yt-splitter/portrait-clip-card.tsx`, `src/app/page.tsx`, updated `src/app/layout.tsx`.
