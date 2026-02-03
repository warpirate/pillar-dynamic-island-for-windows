import { motion } from "motion/react";
import type { MediaInfo } from "../../../hooks/useMediaSession";

// =============================================================================
// Media Playing Indicator (animated bars for idle/hover)
// =============================================================================

interface MediaIndicatorProps {
  isPlaying: boolean;
}

export function MediaIndicator({ isPlaying }: MediaIndicatorProps) {
  return (
    <div className="flex items-end gap-0.5 h-3 ml-1">
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
// Media Expanded View (full controls)
// =============================================================================

/** Derive a short source label from raw app/source ID to avoid wrapping long strings */
function getSourceLabel(appName: string | undefined): string | null {
  if (!appName?.trim()) return null;
  const lower = appName.toLowerCase();
  if (lower.includes("youtube")) return "YouTube";
  if (lower.includes("spotify")) return "Spotify";
  if (lower.includes("chrome")) return "Chrome";
  if (lower.includes("firefox")) return "Firefox";
  if (lower.includes("edge")) return "Edge";
  if (lower.includes("vlc")) return "VLC";
  // Fallback: show first 18 chars + ellipsis so it stays one line
  return appName.length > 18 ? `${appName.slice(0, 18)}…` : appName;
}

interface MediaExpandedProps {
  media: MediaInfo | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function MediaExpanded({ 
  media, 
  onPlayPause, 
  onNext, 
  onPrevious 
}: MediaExpandedProps) {
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

  const sourceLabel = getSourceLabel(media.appName);

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
          <span className="text-white font-medium truncate text-[13px]">
            {media.title || "Unknown Track"}
          </span>
          <span className="text-white/85 text-[12px] truncate">
            {media.artist || "Unknown Artist"}
          </span>
          {sourceLabel && (
            <span className="text-white/70 text-[12px] truncate mt-0.5">
              via {sourceLabel}
            </span>
          )}
        </div>
        
        {/* Playing indicator */}
        <MediaIndicator isPlaying={media.isPlaying} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Previous */}
        <motion.button
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
          whileTap={{ scale: 0.9 }}
          onClick={onPrevious}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z"/>
          </svg>
        </motion.button>

        {/* Play/Pause */}
        <motion.button
          className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white"
          whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.25)" }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlayPause}
        >
          {media.isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z"/>
            </svg>
          )}
        </motion.button>

        {/* Next */}
        <motion.button
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
          whileTap={{ scale: 0.9 }}
          onClick={onNext}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm8.5 0h2V6h-2v12z"/>
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
