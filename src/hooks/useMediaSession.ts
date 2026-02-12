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

interface UseMediaSessionReturn {
  media: MediaInfo | null;
  isLoading: boolean;
  error: string | null;
  playPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface RawMediaInfo {
  title: string;
  artist: string;
  album?: string;
  is_playing: boolean;
  app_name?: string;
}

// =============================================================================
// Hook
// =============================================================================

export function useMediaSession(
  pollInterval = 600,
  onMediaChange?: (media: MediaInfo | null) => void
): UseMediaSessionReturn {
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMediaChangeRef = useRef(onMediaChange);
  onMediaChangeRef.current = onMediaChange;

  // Fetch media session info
  const fetchMedia = useCallback(async () => {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get media session");
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
    // Refresh immediately after action
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
    isLoading,
    error,
    playPause,
    next,
    previous,
    refresh,
  };
}
