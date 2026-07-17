# ShortSplit — Handoff Document

## Overview
ShortSplit is a Next.js web app that splits YouTube videos into portrait (9:16) clips. Users paste a YouTube link, choose clip length/count, preview clips in a grid or TikTok-style feed, and copy share links.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 + `tw-animate-css`
- **UI Components**: shadcn/ui (Radix primitives)
- **Icons**: Lucide React
- **Language**: TypeScript
- **Package Manager**: Bun
- **YouTube Integration**: YouTube IFrame Player API (client-side duration detection + video playback)

## Key Files

### Pages & Layout
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main page — URL input, split settings, clips grid, TikTok view toggle |
| `src/app/layout.tsx` | Root layout with metadata, fonts, Toaster |
| `src/app/globals.css` | Tailwind theme, CSS variables, dark mode |

### API Routes
| File | Purpose |
|------|---------|
| `src/app/api/video-info/route.ts` | POST — fetches video metadata (title, author, thumbnail) via oEmbed |
| `src/app/api/route.ts` | Simple health-check GET |

### Components
| File | Purpose |
|------|---------|
| `src/components/yt-splitter/portrait-clip-card.tsx` | Individual clip card with YouTube embed, edit title/times, copy/share/delete |
| `src/components/yt-splitter/tiktok-view.tsx` | Fullscreen TikTok-style vertical scroll feed with autoplay, static UI overlay, all clips pre-loaded |
| `src/components/ui/*.tsx` | shadcn/ui components (button, card, badge, slider, tabs, input, etc.) |

### Hooks
| File | Purpose |
|------|---------|
| `src/hooks/use-youtube-duration.ts` | Detects video length client-side via hidden YT IFrame player |
| `src/hooks/use-toast.ts` | Toast notification hook (shadcn) |
| `src/hooks/use-mobile.ts` | Mobile detection hook |

### Lib
| File | Purpose |
|------|---------|
| `src/lib/youtube.ts` | Shared utils — `extractVideoId`, `formatDuration`, `buildEmbedUrl`, `buildShareUrl`, types (`VideoInfo`, `Clip`) |
| `src/lib/db.ts` | Database client (SQLite via custom.db) |
| `src/lib/utils.ts` | `cn()` utility for Tailwind class merging |

## Features Built

### Core Splitter
- Paste YouTube URL (watch, youtu.be, shorts, live)
- Auto-detect video duration via hidden YT player
- Split by clip length (5–120s) or by clip count (2–20)
- Edit clip titles, start/end times manually
- Add/remove individual segments
- Copy all share links at once
- Fill (crop) or Fit (letterbox) portrait mode

### TikTok View
- Fullscreen immersive vertical feed with snap scrolling
- Each clip pre-loaded in its own YouTube player (instant switching)
- Autoplay on scroll with sound
- Static UI overlay (top bar, time indicator, bottom info, action buttons, progress dots)
- Time indicator showing elapsed / total
- Fullscreen API toggle
- Arrow key navigation (Up/Down) and Escape to exit
- Pre-cues next clip for smoother transitions

### Deployment
- Ready for Vercel (deploy via `vercel` CLI or GitHub import)

## Build & Run
```bash
bun install
bun dev          # development on port 3000
bun run build    # production build
bun start        # start production server
```

## Notes
- Video duration is detected client-side (YouTube no longer exposes it via oEmbed)
- All video playback uses YouTube embeds — no files are downloaded or re-encoded
- `next.config.ts` has `output: "standalone"` — works on Vercel and self-hosted Node.js
- Database (`db/custom.db`) is SQLite via Prisma — used for any persistent data
