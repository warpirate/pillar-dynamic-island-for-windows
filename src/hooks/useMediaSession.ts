import { useState, useEffect, useCallback, useRef } from "react";
import { platformApi } from "../lib/platform";
import { useAdaptivePolling } from "./useAdaptivePolling";
import { useGracefulDegradation } from "./useGracefulDegradation";

// =============================================================================
// Types
// =============================================================================

export interface MediaInfo {
  title: string;
  artist: string;
  album?: string;
  isPlaying: boolean;
  appName?: string;
}

export interface MediaTimeline {
  positionMs: number;
  durationMs: number;
  canSeek: boolean;
}

export interface MediaPlaybackInfo {
  repeatMode: "none" | "track" | "list";
  isShuffle: boolean;
}

interface UseMediaSessionReturn {
  media: MediaInfo | null;
  recentSources: string[];
  timeline: MediaTimeline | null;
  playbackInfo: MediaPlaybackInfo | null;
  isLoading: boolean;
  error: string | null;
  playPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  toggleRepeat: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  pauseOtherSessions: () => Promise<void>;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useMediaSession(
  pollInterval = 600,
  onMediaChange?: (media: MediaInfo | null) => void
): UseMediaSessionReturn {
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [recentSources, setRecentSources] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<MediaTimeline | null>(null);
  const [playbackInfo, setPlaybackInfo] = useState<MediaPlaybackInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);
  const onMediaChangeRef = useRef(onMediaChange);
  onMediaChangeRef.current = onMediaChange;
  const { handleError, clearError } = useGracefulDegradation({
    maxRetries: 3,
    retryDelay: 1500,
  });
  
  // Adaptive polling for reduced CPU usage
  const { isDeepSleep, triggerActivity, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(500, pollInterval / 3),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 4,
    deepSleepThreshold: 300000,
  });

  // Fetch media session info (with in-flight guard to prevent overlapping requests)
  const fetchMedia = useCallback(async () => {
    if (isPendingRef.current) return; // Skip if previous request still in-flight
    isPendingRef.current = true;
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaSession) {
        setMedia(null);
        setTimeline(null);
        setPlaybackInfo(null);
        setError(null);
        return;
      }
      const result = await platformApi.getMediaSession();

      // Transform snake_case to camelCase
      const transformed = result
        ? {
            title: result.title || "",
            artist: result.artist || "",
            album: result.album || undefined,
            isPlaying: result.is_playing || false,
            appName: result.app_name || undefined,
          }
        : null;

      setMedia(transformed);
      setError(null);
      if (transformed?.appName) {
        setRecentSources((prev) => {
          const deduped = [transformed.appName!, ...prev.filter((s) => s !== transformed.appName)];
          return deduped.slice(0, 5);
        });
      }

      if (onMediaChangeRef.current) {
        onMediaChangeRef.current(transformed);
      }

      // Fetch timeline and playback info when media exists
      if (transformed) {
        const rawTimeline = await platformApi.getMediaTimeline();
        if (rawTimeline) {
          setTimeline({
            positionMs: rawTimeline.position_ms,
            durationMs: rawTimeline.duration_ms,
            canSeek: rawTimeline.can_seek,
          });
        } else {
          setTimeline(null);
        }

        const rawPlayback = await platformApi.getMediaPlaybackInfo();
        if (rawPlayback) {
          setPlaybackInfo({
            repeatMode: rawPlayback.repeat_mode as "none" | "track" | "list",
            isShuffle: rawPlayback.is_shuffle,
          });
        } else {
          setPlaybackInfo(null);
        }
      } else {
        setTimeline(null);
        setPlaybackInfo(null);
      }
    } catch (e) {
      handleError("media_session", e instanceof Error ? e : "Media session fetch failed");
      setError(e instanceof Error ? e.message : "Failed to get media session");
    } finally {
      isPendingRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchMedia();
    setIsLoading(false);
  }, [fetchMedia]);

  // Media controls
  const playPause = useCallback(async () => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.mediaPlayPause();
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to toggle play/pause");
    }
    setTimeout(fetchMedia, 100);
    triggerActivity(); // Mark user as active
  }, [clearError, fetchMedia, handleError, triggerActivity]);

  const next = useCallback(async () => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.mediaNext();
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to skip next");
    }
    setTimeout(fetchMedia, 100);
    triggerActivity(); // Mark user as active
  }, [clearError, fetchMedia, handleError, triggerActivity]);

  const previous = useCallback(async () => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.mediaPrevious();
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to go previous");
    }
    setTimeout(fetchMedia, 100);
    triggerActivity(); // Mark user as active
  }, [clearError, fetchMedia, handleError, triggerActivity]);

  const toggleRepeat = useCallback(async () => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.mediaToggleRepeat();
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to toggle repeat");
    }
    setTimeout(fetchMedia, 100);
    triggerActivity(); // Mark user as active
  }, [clearError, fetchMedia, handleError, triggerActivity]);

  const toggleShuffle = useCallback(async () => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.mediaToggleShuffle();
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to toggle shuffle");
    }
    setTimeout(fetchMedia, 100);
    triggerActivity(); // Mark user as active
  }, [clearError, fetchMedia, handleError, triggerActivity]);

  const seekTo = useCallback(async (positionMs: number) => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.seekMedia(Math.round(positionMs));
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to seek media");
    }
    setTimeout(fetchMedia, 150);
    triggerActivity(); // Mark user as active
  }, [clearError, fetchMedia, handleError, triggerActivity]);

  const pauseOtherSessions = useCallback(async () => {
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.mediaControls) return;
      await platformApi.pauseOtherSessions();
      clearError("media_controls");
    } catch (e) {
      handleError("media_controls", e instanceof Error ? e : "Failed to pause other sessions");
    }
    triggerActivity(); // Mark user as active
  }, [clearError, handleError, triggerActivity]);

  // Start polling when mounted
  useEffect(() => {
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (!isDeepSleep) {
        const interval = getCurrentInterval();
        pollIntervalRef.current = setInterval(fetchMedia, interval);
      }
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchMedia();
        resetIdleTimer(); // Reset idle timer when becoming visible
        startPolling();
      }
    };

    fetchMedia();
    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchMedia, getCurrentInterval, isDeepSleep, resetIdleTimer]);

  return {
    media,
    recentSources,
    timeline,
    playbackInfo,
    isLoading,
    error,
    playPause,
    next,
    previous,
    toggleRepeat,
    toggleShuffle,
    seekTo,
    pauseOtherSessions,
    refresh,
  };
}
