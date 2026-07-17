"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Scissors,
  Youtube,
  ClipboardPaste,
  Loader2,
  Sparkles,
  Plus,
  RefreshCw,
  Copy,
  Trash2,
  Film,
  Clock,
  LayoutGrid,
  User,
  Wand2,
  Smartphone,
  Maximize2,
  Crop,
  AlertCircle,
  ListVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useYouTubeDuration } from "@/hooks/use-youtube-duration";
import { PortraitClipCard } from "@/components/yt-splitter/portrait-clip-card";
import { TikTokView } from "@/components/yt-splitter/tiktok-view";
import {
  extractVideoId,
  formatDuration,
  buildShareUrl,
  type VideoInfo,
  type Clip,
} from "@/lib/youtube";

type SplitMode = "length" | "count";
type FitMode = "fill" | "fit";

const EXAMPLES = [
  { label: "Lo-fi mix", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
  { label: "Tech talk", url: "https://youtu.be/aircAruvnKk" },
  { label: "Documentary", url: "https://www.youtube.com/watch?v=YbY8u5S1nUs" },
];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Parse "mm:ss" or "h:mm:ss" or a plain number of seconds into seconds. */
function parseTimeToSeconds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, parseFloat(s));
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  let sec = 0;
  for (const n of nums) sec = sec * 60 + n;
  return sec;
}

/** Pure helper: build a list of clip segments for a given total duration. */
function buildSegments(
  duration: number,
  mode: SplitMode,
  length: number,
  count: number
): { start: number; end: number }[] {
  const D = Math.max(1, duration);
  const segments: { start: number; end: number }[] = [];
  if (mode === "length") {
    const L = Math.max(1, length);
    for (let t = 0; t < D; t += L) {
      segments.push({ start: t, end: Math.min(t + L, D) });
    }
  } else {
    const n = Math.max(1, count);
    const seg = D / n;
    for (let i = 0; i < n; i++) {
      segments.push({ start: i * seg, end: (i + 1) * seg });
    }
  }
  return segments;
}

function segmentsToClips(
  segments: { start: number; end: number }[]
): Clip[] {
  return segments.map((s, i) => ({
    id: uid(),
    index: i + 1,
    start: Math.floor(s.start),
    end: Math.ceil(s.end),
    title: `Part ${i + 1}`,
  }));
}

export default function Page() {
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);

  const [viewMode, setViewMode] = useState<"grid" | "tiktok">("grid");

  // Split config
  const [splitMode, setSplitMode] = useState<SplitMode>("length");
  const [clipLength, setClipLength] = useState(30);
  const [clipCount, setClipCount] = useState(6);
  const [fitMode, setFitMode] = useState<FitMode>("fill");
  const [clips, setClips] = useState<Clip[]>([]);

  // Editable total duration (seconds). Detected client-side; user can override.
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [totalInput, setTotalInput] = useState("");

  const clipsGridRef = useRef<HTMLDivElement>(null);
  // True once the user manually sets the length for the current video, so an
  // auto-detected value arriving later doesn't clobber their override.
  const manualDurationRef = useRef(false);

  // Client-side duration detection via the YouTube IFrame Player API.
  const {
    duration: detectedDuration,
    detecting: detectingDuration,
  } = useYouTubeDuration(video?.videoId ?? null);

  const effectiveDuration = totalSeconds;

  const previewCount = useMemo(() => {
    if (!effectiveDuration || effectiveDuration <= 0) return 0;
    if (splitMode === "length") {
      return Math.ceil(effectiveDuration / Math.max(1, clipLength));
    }
    return Math.max(1, clipCount);
  }, [effectiveDuration, splitMode, clipLength, clipCount]);

  const generateClips = useCallback(
    (opts: { focusFirst?: boolean } = {}) => {
      const D = effectiveDuration;
      if (!D || D <= 0) return;
      const segments = buildSegments(D, splitMode, clipLength, clipCount);
      setClips(segmentsToClips(segments));

      if (opts.focusFirst) {
        setTimeout(() => {
          clipsGridRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 50);
      }
    },
    [effectiveDuration, splitMode, clipLength, clipCount]
  );

  // Apply auto-detected duration once it arrives (unless the user already set
  // a length manually for this video), then generate a default clip set.
  useEffect(() => {
    if (
      video &&
      detectedDuration &&
      detectedDuration > 0 &&
      !manualDurationRef.current &&
      totalSeconds == null
    ) {
      setTotalSeconds(detectedDuration);
      setTotalInput(formatDuration(detectedDuration));
      const segments = buildSegments(detectedDuration, "length", 30, clipCount);
      setClips(segmentsToClips(segments));
    }
  }, [video, detectedDuration, totalSeconds, clipCount]);

  async function handleFetch(rawUrl?: string) {
    const target = (rawUrl ?? url).trim();
    if (!target) {
      setError("Paste a YouTube link first.");
      return;
    }
    const id = extractVideoId(target);
    if (!id) {
      setError("That doesn't look like a YouTube link. Try a watch, youtu.be, or shorts URL.");
      return;
    }

    setLoading(true);
    setError(null);
    setVideo(null);
    setClips([]);
    manualDurationRef.current = false;

    try {
      const res = await fetch("/api/video-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load video info.");
      }
      setVideo(data as VideoInfo);
      // Duration is detected client-side via the IFrame API (see effect below).
      setTotalSeconds(null);
      setTotalInput("");
      setUrl(target);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      toast({ title: "Could not load video", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        handleFetch(text);
      }
    } catch {
      toast({
        title: "Clipboard unavailable",
        description: "Paste the link manually into the field.",
      });
    }
  }

  function updateClip(updated: Clip) {
    setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function deleteClip(id: string) {
    setClips((prev) =>
      prev
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, index: i + 1 }))
    );
  }

  function addClip() {
    setClips((prev) => {
      const lastEnd = prev.length ? prev[prev.length - 1].end : 0;
      const D = effectiveDuration ?? lastEnd + 30;
      const start = Math.min(lastEnd, Math.max(0, D - 30));
      const end = Math.min(start + 30, D);
      return [
        ...prev,
        {
          id: uid(),
          index: prev.length + 1,
          start,
          end,
          title: `Part ${prev.length + 1}`,
        },
      ];
    });
  }

  function clearClips() {
    setClips([]);
  }

  function copyAllLinks() {
    if (!video || clips.length === 0) return;
    const text = clips
      .map(
        (c) =>
          `${c.title} (${formatDuration(c.start)}-${formatDuration(
            c.end
          )}): ${buildShareUrl(video.videoId, c.start)}`
      )
      .join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      toast({
        title: "Copied all clip links",
        description: `${clips.length} segments copied to clipboard.`,
      });
    });
  }

  function commitTotalInput() {
    const sec = parseTimeToSeconds(totalInput);
    if (sec == null || sec <= 0) {
      toast({
        title: "Invalid length",
        description: "Use mm:ss or h:mm:ss format.",
        variant: "destructive",
      });
      setTotalInput(totalSeconds ? formatDuration(totalSeconds) : "");
      return;
    }
    setTotalSeconds(sec);
    manualDurationRef.current = true;
    toast({ title: "Total length updated", description: formatDuration(sec) });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="text-base tracking-tight">
              ShortSplit<span className="text-rose-600">.</span>
            </span>
          </div>
          <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
            <Sparkles className="mr-1 h-3 w-3" /> Web-only
          </Badge>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">9:16 portrait clips</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero / input */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, rgba(244,63,94,0.10), transparent 70%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="secondary"
                className="mb-4 rounded-full border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
              >
                <Youtube className="mr-1.5 h-3.5 w-3.5" />
                YouTube → Vertical Shorts
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Split any YouTube video into
                <span className="text-rose-600"> portrait shorts</span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-balance text-sm text-muted-foreground sm:text-base">
                Paste a link, choose your clip length, and instantly preview
                mobile-ready 9:16 segments. Everything runs in your browser —
                no downloads, no installs, no re-encoding.
              </p>
            </div>

            {/* URL input */}
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFetch();
                    }}
                    placeholder="Paste YouTube link…  e.g. youtube.com/watch?v=…"
                    className="h-12 rounded-xl pl-9 pr-3 text-sm shadow-sm"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-rose-600 px-6 text-white shadow-sm hover:bg-rose-700"
                  onClick={() => handleFetch()}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="mr-2 h-4 w-4" />
                  )}
                  Split it
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handlePaste}
                >
                  <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                  Paste from clipboard
                </Button>
                <span className="text-muted-foreground/50">·</span>
                <span className="mr-1">Try:</span>
                {EXAMPLES.map((ex) => (
                  <Button
                    key={ex.url}
                    variant="link"
                    size="sm"
                    className="h-7 px-2 text-xs text-rose-600"
                    onClick={() => {
                      setUrl(ex.url);
                      handleFetch(ex.url);
                    }}
                  >
                    {ex.label}
                  </Button>
                ))}
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="mx-auto w-full max-w-6xl px-4 py-8">
          {loading && <LoadingState />}

          {!loading && video && (
            <div className="flex flex-col gap-6">
              {/* Video info + fit mode */}
              <Card className="overflow-hidden">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black sm:w-56">
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      fill
                      sizes="224px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="line-clamp-2 text-lg font-semibold leading-snug">
                      {video.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {video.author}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {totalSeconds != null ? (
                          <span className="inline-flex items-center gap-1">
                            {formatDuration(totalSeconds)}
                            <Badge
                              variant="secondary"
                              className="h-4 rounded px-1.5 text-[10px] font-normal"
                            >
                              {manualDurationRef.current ? "manual" : "auto"}
                            </Badge>
                          </span>
                        ) : detectingDuration ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Detecting length…
                          </span>
                        ) : (
                          "Unknown length"
                        )}
                      </span>
                    </div>

                    {/* Editable total length */}
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor="total"
                          className="text-xs text-muted-foreground"
                        >
                          Total length (mm:ss)
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            id="total"
                            value={totalInput}
                            onChange={(e) => setTotalInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitTotalInput();
                            }}
                            placeholder="0:00"
                            className="h-9 w-28 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9"
                            onClick={commitTotalInput}
                          >
                            Set
                          </Button>
                        </div>
                      </div>

                      <Separator
                        orientation="vertical"
                        className="hidden h-10 sm:block"
                      />

                      {/* Fit mode */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Portrait fit
                        </Label>
                        <ToggleGroup
                          type="single"
                          value={fitMode}
                          onValueChange={(v) => {
                            if (v) setFitMode(v as FitMode);
                          }}
                          className="inline-flex h-9 rounded-lg border bg-muted/40 p-1"
                        >
                          <ToggleGroupItem
                            value="fill"
                            className="h-7 gap-1.5 rounded-md px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
                          >
                            <Crop className="h-3.5 w-3.5" />
                            Fill (crop)
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="fit"
                            className="h-7 gap-1.5 rounded-md px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                            Fit (bars)
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Split config */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wand2 className="h-4 w-4 text-rose-600" />
                        Split settings
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Auto-divide the video, then tweak each clip by hand.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      <ListVideo className="mr-1.5 h-3.5 w-3.5" />
                      {clips.length} clips
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs
                    value={splitMode}
                    onValueChange={(v) => setSplitMode(v as SplitMode)}
                  >
                    <TabsList className="grid w-full max-w-xs grid-cols-2">
                      <TabsTrigger value="length">
                        <Clock className="mr-1.5 h-3.5 w-3.5" />
                        By length
                      </TabsTrigger>
                      <TabsTrigger value="count">
                        <ListVideo className="mr-1.5 h-3.5 w-3.5" />
                        By count
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="length"
                      className="mt-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Seconds per clip</Label>
                        <Badge variant="secondary" className="rounded-full">
                          {clipLength}s
                        </Badge>
                      </div>
                      <Slider
                        value={[clipLength]}
                        onValueChange={(v) => setClipLength(v[0])}
                        min={5}
                        max={120}
                        step={5}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[15, 30, 45, 60, 90].map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={clipLength === s ? "default" : "outline"}
                            className={
                              clipLength === s
                                ? "h-7 bg-rose-600 text-white hover:bg-rose-700"
                                : "h-7"
                            }
                            onClick={() => setClipLength(s)}
                          >
                            {s}s
                          </Button>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="count" className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Number of clips</Label>
                        <Badge variant="secondary" className="rounded-full">
                          {clipCount} clips
                        </Badge>
                      </div>
                      <Slider
                        value={[clipCount]}
                        onValueChange={(v) => setClipCount(v[0])}
                        min={2}
                        max={20}
                        step={1}
                      />
                    </TabsContent>
                  </Tabs>

                  {effectiveDuration == null && !detectingDuration && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Length couldn&apos;t be auto-detected. Enter the total
                        length above (mm:ss) to enable splitting.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      onClick={() => generateClips({ focusFirst: true })}
                      disabled={effectiveDuration == null}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate {previewCount > 0 ? `${previewCount} ` : ""}clips
                    </Button>
                    <Button variant="outline" onClick={addClip}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add segment
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={copyAllLinks}
                      disabled={clips.length === 0}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy all links
                    </Button>
                    {clips.length > 0 && (
                      <Button
                        variant="ghost"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        onClick={clearClips}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear all
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Clips grid */}
              <div ref={clipsGridRef} className="scroll-mt-20">
                {clips.length === 0 ? (
                  <EmptyClips canGenerate={effectiveDuration != null} />
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Film className="h-4 w-4" />
                        {clips.length} portrait clips
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setViewMode("tiktok")}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        TikTok view
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {clips.map((clip) => (
                        <PortraitClipCard
                          key={clip.id}
                          clip={clip}
                          videoId={video.videoId}
                          fitMode={fitMode}
                          onChange={updateClip}
                          onDelete={() => deleteClip(clip.id)}
                          onCopy={() => {
                            toast({
                              title: "Link copied",
                              description:
                                "Segment share link is on your clipboard.",
                            });
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!loading && !video && <EmptyState />}
        </section>
      </main>

      {/* TikTok fullscreen overlay */}
      {viewMode === "tiktok" && video && clips.length > 0 && (
        <TikTokView
          clips={clips}
          videoId={video.videoId}
          fitMode={fitMode}
          onClose={() => setViewMode("grid")}
          onDelete={(id) => deleteClip(id)}
          onCopy={() => {}}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-border/80 bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-1.5">
            <Scissors className="h-3.5 w-3.5 text-rose-600" />
            ShortSplit — preview-only, plays via YouTube embeds. No video files
            are downloaded or re-encoded.
          </p>
          <p>Works on mobile · tablet · desktop</p>
        </div>
      </footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
          <Skeleton className="aspect-video w-full rounded-lg sm:w-56" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-64" />
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-6 w-32" />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function EmptyClips({ canGenerate }: { canGenerate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Film className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No clips yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {canGenerate
          ? "Hit “Generate clips” to auto-split, or add a custom segment."
          : "Set the total length above to start splitting."}
      </p>
    </div>
  );
}

function EmptyState() {
  const steps = [
    {
      icon: Youtube,
      title: "1 · Paste a link",
      desc: "Any YouTube watch, youtu.be, Shorts or Live URL works.",
    },
    {
      icon: Wand2,
      title: "2 · Choose length",
      desc: "Auto-split into 15–90s parts, or pick how many clips you want.",
    },
    {
      icon: Smartphone,
      title: "3 · Preview in portrait",
      desc: "Each clip shows in a 9:16 phone frame, ready for mobile.",
    },
    {
      icon: Copy,
      title: "4 · Share segments",
      desc: "Copy deep-links that jump straight to each clip’s start.",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s) => (
        <Card key={s.title} className="gap-2 p-5">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
            <s.icon className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold">{s.title}</h3>
          <p className="text-xs text-muted-foreground">{s.desc}</p>
        </Card>
      ))}
    </div>
  );
}
