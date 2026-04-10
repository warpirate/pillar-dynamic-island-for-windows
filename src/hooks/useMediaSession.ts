import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";

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

interface RawMediaInfo {
  title: string;
  artist: string;
  album?: string;
  is_playing: boolean;
  app_name?: string;
}

interface RawMediaTimeline {
  position_ms: number;
  duration_ms: number;
  can_seek: boolean;
}

interface RawMediaPlaybackInfo {
  repeat_mode: string;
  is_shuffle: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useMediaSession(
  pollInterval = 600,
  onMediaChange?: (media: MediaInfo | null) => void
): UseMediaSessionReturn {
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [timeline, setTimeline] = useState<MediaTimeline | null>(null);
  const [playbackInfo, setPlaybackInfo] = useState<MediaPlaybackInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);
  const onMediaChangeRef = useRef(onMediaChange);
  onMediaChangeRef.current = onMediaChange;

  // Fetch media session info (with in-flight guard to prevent overlapping requests)
  const fetchMedia = useCallback(async () => {
    if (isPendingRef.current) return; // Skip if previous request still in-flight
    isPendingRef.current = true;
    try {
      const result = await tauriInvoke<RawMediaInfo | null>("get_media_session");

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

      if (onMediaChangeRef.current) {
        onMediaChangeRef.current(transformed);
      }

      // Fetch timeline and playback info when media exists
      if (transformed) {
        const rawTimeline = await tauriInvoke<RawMediaTimeline | null>("get_media_timeline");
        if (rawTimeline) {
          setTimeline({
            positionMs: rawTimeline.position_ms,
            durationMs: rawTimeline.duration_ms,
            canSeek: rawTimeline.can_seek,
          });
        } else {
          setTimeline(null);
        }

        const rawPlayback = await tauriInvoke<RawMediaPlaybackInfo | null>("get_media_playback_info");
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
    await tauriInvoke("media_play_pause");
    setTimeout(fetchMedia, 100);
  }, [fetchMedia]);

  const next = useCallback(async () => {
    await tauriInvoke("media_next");
    setTimeout(fetchMedia, 100);
  }, [fetchMedia]);

  const previous = useCallback(async () => {
    await tauriInvoke("media_previous");
    setTimeout(fetchMedia, 100);
  }, [fetchMedia]);

  const toggleRepeat = useCallback(async () => {
    await tauriInvoke("media_toggle_repeat");
    setTimeout(fetchMedia, 100);
  }, [fetchMedia]);

  const toggleShuffle = useCallback(async () => {
    await tauriInvoke("media_toggle_shuffle");
    setTimeout(fetchMedia, 100);
  }, [fetchMedia]);

  const seekTo = useCallback(async (positionMs: number) => {
    await tauriInvoke("seek_media", { positionMs: Math.round(positionMs) });
    setTimeout(fetchMedia, 150);
  }, [fetchMedia]);

  const pauseOtherSessions = useCallback(async () => {
    await tauriInvoke("pause_other_sessions");
  }, []);

  // Start polling when mounted
  useEffect(() => {
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(fetchMedia, pollInterval);
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
  }, [fetchMedia, pollInterval]);

  return {
    media,
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
