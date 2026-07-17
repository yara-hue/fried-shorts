"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Play,
  Copy,
  Trash2,
  RefreshCw,
  Check,
  Pencil,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  buildEmbedUrl,
  buildShareUrl,
  formatStamp,
  type Clip,
} from "@/lib/youtube";
import { cn } from "@/lib/utils";

type FitMode = "fill" | "fit";

export function PortraitClipCard({
  clip,
  videoId,
  fitMode,
  onChange,
  onDelete,
  onCopy,
}: {
  clip: Clip;
  videoId: string;
  fitMode: FitMode;
  onChange: (next: Clip) => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTimes, setEditingTimes] = useState(false);
  const [copied, setCopied] = useState(false);

  const dur = Math.max(0, clip.end - clip.start);

  function handleCopy() {
    const link = buildShareUrl(videoId, clip.start);
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      onCopy(link);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
      {/* Phone-style portrait frame */}
      <div className="relative w-full aspect-[9/16] overflow-hidden bg-black">
        {/* Notch */}
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/25" />

        {/* Clip number badge */}
        <Badge
          className="absolute left-2 top-2 z-20 rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/70"
          variant="secondary"
        >
          #{clip.index}
        </Badge>

        {/* Duration badge */}
        <Badge
          className="absolute right-2 top-2 z-20 rounded-full bg-rose-600/90 text-white backdrop-blur hover:bg-rose-600/90"
          variant="secondary"
        >
          {formatStamp(dur)}
        </Badge>

        {playing ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Wrapper sized by fit mode to crop or letterbox the 16:9 embed */}
            <div
              className={cn(
                "relative",
                fitMode === "fill"
                  ? "h-full aspect-video"
                  : "w-full aspect-video"
              )}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src={buildEmbedUrl(videoId, clip.start, clip.end, {
                  autoplay: true,
                })}
                title={clip.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={`Play clip ${clip.index}`}
          >
            <Image
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={clip.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className={cn(
                "object-cover transition-transform duration-300 group-hover:scale-105",
                fitMode === "fit" ? "object-contain" : "object-cover"
              )}
              unoptimized
            />
            {/* Dark gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

            {/* Play button */}
            <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg ring-4 ring-white/20 transition-transform group-hover:scale-110">
              <Play className="h-6 w-6 translate-x-0.5 fill-white" />
            </span>

            {/* Time range */}
            <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {formatStamp(clip.start)} – {formatStamp(clip.end)}
            </div>
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {editingTitle ? (
          <Input
            autoFocus
            value={clip.title}
            onChange={(e) => onChange({ ...clip, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditingTitle(false);
            }}
            className="h-8 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold leading-tight hover:text-rose-600"
          >
            <span className="line-clamp-2">{clip.title}</span>
            <Pencil className="h-3 w-3 shrink-0 opacity-40" />
          </button>
        )}

        {editingTimes ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              value={Math.floor(clip.start)}
              onChange={(e) =>
                onChange({
                  ...clip,
                  start: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="h-7 w-full text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="number"
              min={0}
              value={Math.floor(clip.end)}
              onChange={(e) =>
                onChange({
                  ...clip,
                  end: Math.max(clip.start + 1, Number(e.target.value) || 0),
                })
              }
              className="h-7 w-full text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => setEditingTimes(false)}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingTimes(true)}
            className="flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span>
              {formatStamp(clip.start)} → {formatStamp(clip.end)}
            </span>
            <Pencil className="h-3 w-3 opacity-50" />
          </button>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1 pt-1">
          {playing ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1"
              onClick={() => setPlaying(false)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 flex-1 bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => setPlaying(true)}
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-white" />
              Play
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={handleCopy}
            title="Copy share link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() =>
              window.open(buildShareUrl(videoId, clip.start), "_blank")
            }
            title="Open on YouTube"
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 hover:border-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete clip"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
