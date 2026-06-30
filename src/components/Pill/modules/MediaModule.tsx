import { motion } from "motion/react";
import { useState, useCallback, useRef, useMemo } from "react";
import type { MediaInfo, MediaTimeline, MediaPlaybackInfo } from "../../../hooks/useMediaSession";
import { microInteractions, gpuLayerHints } from "../animations";

// =============================================================================
// Media Playing Indicator (animated bars for idle/hover)
// =============================================================================

interface MediaIndicatorProps {
  isPlaying: boolean;
}

export function MediaIndicator({ isPlaying }: MediaIndicatorProps) {
  return (
    <div className="flex items-end gap-0.5 h-3 ml-1" style={gpuLayerHints.transform}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-0.5 bg-blue-400 rounded-full"
          animate={{
            height: isPlaying
              ? ["4px", "12px", "6px", "10px", "4px"]
              : "4px",
          }}
          transition={{
            duration: 0.8,
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
          style={gpuLayerHints.transform}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Media Compact View (for idle/hover state)
// =============================================================================

interface MediaCompactProps {
  media: MediaInfo;
  onPlayPause?: () => void;
}

export function MediaCompact({ media, onPlayPause }: MediaCompactProps) {
  return (
    <div
      className="flex items-center gap-2 px-1 cursor-pointer"
      onClick={onPlayPause}
    >
      <MediaIndicator isPlaying={media.isPlaying} />
      <span className="text-[12px] text-white/90 truncate max-w-[80px]">
        {media.title || "Unknown"}
      </span>
    </div>
  );
}

// =============================================================================
// Seekbar Component
// =============================================================================

// Cache for formatted times to avoid repeated calculations
const timeCache = new Map<number, string>();
const MAX_TIME_CACHE_SIZE = 100;

function formatTime(ms: number): string {
  const cached = timeCache.get(ms);
  if (cached) return cached;
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const result = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  
  // Limit cache size
  if (timeCache.size > MAX_TIME_CACHE_SIZE) {
    timeCache.clear();
  }
  timeCache.set(ms, result);
  
  return result;
}

interface SeekBarProps {
  timeline: MediaTimeline;
  accentColor?: string;
  onSeek: (positionMs: number) => void;
}

function SeekBar({ timeline, accentColor, onSeek }: SeekBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const progress = isDragging
    ? dragPosition
    : timeline.durationMs > 0
    ? timeline.positionMs / timeline.durationMs
    : 0;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!timeline.canSeek || !barRef.current) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rect = barRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragPosition(pos);
      setIsDragging(true);
    },
    [timeline.canSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragPosition(pos);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    onSeek(dragPosition * timeline.durationMs);
  }, [isDragging, dragPosition, timeline.durationMs, onSeek]);

  const displayPosition = isDragging
    ? dragPosition * timeline.durationMs
    : timeline.positionMs;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!timeline.canSeek) return;
      let next: number | null = null;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = timeline.positionMs + 5000;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = timeline.positionMs - 5000;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = timeline.durationMs;
          break;
        default:
          return;
      }
      e.preventDefault();
      onSeek(Math.max(0, Math.min(timeline.durationMs, next)));
    },
    [timeline.canSeek, timeline.positionMs, timeline.durationMs, onSeek]
  );

  return (
    <div className="flex flex-col gap-1 w-full px-1">
      <div
        ref={barRef}
        className="relative h-1.5 bg-white/15 rounded-full cursor-pointer group"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={timeline.durationMs}
        aria-valuenow={displayPosition}
        aria-valuetext={formatTime(displayPosition)}
        tabIndex={timeline.canSeek ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={gpuLayerHints.transform}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: accentColor || "#3B82F6",
          }}
        />
        {/* Drag handle — visible on hover/drag */}
        {timeline.canSeek && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              left: `calc(${progress * 100}% - 6px)`,
              backgroundColor: accentColor || "#3B82F6",
              opacity: isDragging ? 1 : undefined,
            }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-white/50">
        <span>{formatTime(displayPosition)}</span>
        <span>{formatTime(timeline.durationMs)}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Repeat & Shuffle Icons
// =============================================================================

function RepeatIcon({ mode }: { mode: "none" | "track" | "list" }) {
  if (mode === "track") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
        <text x="12" y="15" textAnchor="middle" fontSize="8" fill="currentColor">1</text>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>
  );
}

// =============================================================================
// Media Expanded View (full controls)
// =============================================================================

// Cache for source labels to avoid repeated string operations
const sourceLabelCache = new Map<string, string | null>();
const MAX_SOURCE_CACHE_SIZE = 50;

/** Derive a short source label from raw app/source ID to avoid wrapping long strings */
function getSourceLabel(appName: string | undefined): string | null {
  if (!appName?.trim()) return null;
  
  const cached = sourceLabelCache.get(appName);
  if (cached !== undefined) return cached;
  
  const lower = appName.toLowerCase();
  let result: string | null;
  
  if (lower.includes("youtube")) result = "YouTube";
  else if (lower.includes("spotify")) result = "Spotify";
  else if (lower.includes("chrome")) result = "Chrome";
  else if (lower.includes("firefox")) result = "Firefox";
  else if (lower.includes("edge")) result = "Edge";
  else if (lower.includes("vlc")) result = "VLC";
  else result = appName.length > 18 ? `${appName.slice(0, 18)}…` : appName;
  
  // Limit cache size
  if (sourceLabelCache.size > MAX_SOURCE_CACHE_SIZE) {
    sourceLabelCache.clear();
  }
  sourceLabelCache.set(appName, result);
  
  return result;
}

interface MediaExpandedProps {
  media: MediaInfo | null;
  recentSources?: string[];
  timeline?: MediaTimeline | null;
  playbackInfo?: MediaPlaybackInfo | null;
  accentColor?: string;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleRepeat?: () => void;
  onToggleShuffle?: () => void;
  onPauseOthers?: () => void;
  onSeek?: (positionMs: number) => void;
}

export function MediaExpanded({
  media,
  recentSources = [],
  timeline,
  playbackInfo,
  accentColor,
  onPlayPause,
  onNext,
  onPrevious,
  onToggleRepeat,
  onToggleShuffle,
  onPauseOthers,
  onSeek,
}: MediaExpandedProps) {
  // Memoize source label to avoid recalculation
  const sourceLabel = useMemo(() => {
    if (!media) return null;
    return getSourceLabel(media.appName);
  }, [media?.appName]);

  if (!media) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <span className="text-2xl opacity-50">🎵</span>
        </div>
        <span className="text-white/80 text-[13px]">No media playing</span>
        <span className="text-white/60 text-[12px]">
          Play something in Spotify, YouTube, etc.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Now Playing Info */}
      <div className="flex items-center gap-3">
        {/* Album art placeholder */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">🎵</span>
        </div>

        {/* Track info - single line each, source one line */}
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="text-white font-medium truncate text-pill-md"
            title={media.title || undefined}
          >
            {media.title || "Unknown Track"}
          </span>
          <span
            className="text-pill-muted text-pill-base truncate"
            title={media.artist || undefined}
          >
            {media.artist || "Unknown Artist"}
          </span>
          {sourceLabel && (
            <span
              className="text-white/70 text-pill-base truncate mt-pill-xs"
              title={sourceLabel}
            >
              via {sourceLabel}
            </span>
          )}
        </div>

        {/* Playing indicator */}
        <MediaIndicator isPlaying={media.isPlaying} />
      </div>

      {/* Seekbar */}
      {timeline && timeline.durationMs > 0 && onSeek && (
        <SeekBar
          timeline={timeline}
          accentColor={accentColor}
          onSeek={onSeek}
        />
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Media playback controls">
        {/* Shuffle */}
        {onToggleShuffle && (
          <motion.button
            className="w-7 h-7 rounded-full flex items-center justify-center"
            aria-label={playbackInfo?.isShuffle ? "Disable shuffle" : "Enable shuffle"}
            style={{
              color: playbackInfo?.isShuffle ? (accentColor || "#3B82F6") : "rgba(255,255,255,0.5)",
            }}
            whileHover={microInteractions.icon.whileHover}
            whileTap={microInteractions.icon.whileTap}
            transition={microInteractions.icon.transition}
            onClick={onToggleShuffle}
          >
            <ShuffleIcon />
          </motion.button>
        )}

        {/* Previous */}
        <motion.button
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          aria-label="Previous track"
          whileHover={microInteractions.icon.whileHover}
          whileTap={microInteractions.icon.whileTap}
          style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          transition={microInteractions.icon.transition}
          onClick={onPrevious}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPrevious();
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z"/>
          </svg>
        </motion.button>

        {/* Play/Pause */}
        <motion.button
          className="w-12 h-12 rounded-full flex items-center justify-center text-white"
          aria-label={media.isPlaying ? "Pause playback" : "Play playback"}
          style={{ backgroundColor: accentColor ? `${accentColor}40` : "rgba(255, 255, 255, 0.2)" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlayPause}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPlayPause();
            }
          }}
        >
          {media.isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7L8 5z"/>
            </svg>
          )}
        </motion.button>

        {/* Next */}
        <motion.button
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          aria-label="Next track"
          whileHover={microInteractions.icon.whileHover}
          whileTap={microInteractions.icon.whileTap}
          style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          transition={microInteractions.icon.transition}
          onClick={onNext}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNext();
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 18l8.5-6L6 6v12zm8.5 0h2V6h-2v12z"/>
          </svg>
        </motion.button>

        {/* Repeat */}
        {onToggleRepeat && (
          <motion.button
            className="w-7 h-7 rounded-full flex items-center justify-center"
            aria-label={`Repeat: ${playbackInfo?.repeatMode || "none"}`}
            style={{
              color: playbackInfo?.repeatMode !== "none" ? (accentColor || "#3B82F6") : "rgba(255,255,255,0.5)",
            }}
            whileHover={microInteractions.icon.whileHover}
            whileTap={microInteractions.icon.whileTap}
            transition={microInteractions.icon.transition}
            onClick={onToggleRepeat}
          >
            <RepeatIcon mode={playbackInfo?.repeatMode || "none"} />
          </motion.button>
        )}
      </div>

      {(recentSources.length > 0 || onPauseOthers) && (
        <div className="flex flex-col gap-1.5 mt-1">
          {onPauseOthers && (
            <button
              type="button"
              className="self-center px-2 py-1 rounded text-[10px] bg-white/10 text-white/75 hover:text-white hover:bg-white/15 transition-colors"
              aria-label="Pause audio in other apps"
              onClick={onPauseOthers}
            >
              Pause other sessions
            </button>
          )}
          {recentSources.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center">
              {recentSources.slice(0, 5).map((source) => (
                <span
                  key={source}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    source === media?.appName
                      ? "bg-white/15 text-white border-white/20"
                      : "bg-white/5 text-white/60 border-white/10"
                  }`}
                  aria-label={`Recent media source ${source}`}
                >
                  {source}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
