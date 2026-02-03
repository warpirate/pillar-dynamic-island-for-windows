import { useState, useEffect, useCallback, useRef } from "react";

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

// Tauri invoke helper - Tauri v2 uses window.__TAURI__.core.invoke
const tauriInvoke = async <T,>(cmd: string): Promise<T | null> => {
  // #region agent log
  const hasTauriCore = !!(window as any).__TAURI__?.core?.invoke;
  fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:26',message:'tauriInvoke called',data:{cmd,hasTauriCore},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  if (!(window as any).__TAURI__?.core?.invoke) return null;
  try {
    const result = await (window as any).__TAURI__.core.invoke(cmd) as T;
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:32',message:'tauriInvoke success',data:{cmd,result},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return result;
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:37',message:'tauriInvoke error',data:{cmd,error:String(e)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error(`Tauri invoke failed (${cmd}):`, e);
    return null;
  }
};

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
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:54',message:'fetchMedia called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    try {
      const result = await tauriInvoke<MediaInfo | null>("get_media_session");
      
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:60',message:'get_media_session raw result',data:{result,resultType:typeof result,isNull:result===null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      
      // Transform snake_case to camelCase
      const transformed = result ? {
        title: result.title || "",
        artist: result.artist || "",
        album: (result as any).album || undefined,
        isPlaying: (result as any).is_playing || false,
        appName: (result as any).app_name || undefined,
      } : null;
      
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:73',message:'transformed result',data:{transformed},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      setMedia(transformed);
      setError(null);
      
      if (onMediaChangeRef.current) {
        onMediaChangeRef.current(transformed);
      }
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/79753bc6-4c38-4cab-861d-1bc746d9b298',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useMediaSession.ts:84',message:'fetchMedia error',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
    // Initial fetch
    fetchMedia();

    // Start polling
    pollIntervalRef.current = setInterval(fetchMedia, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchMedia, pollInterval]);

  // Refetch immediately when window becomes visible (e.g. user switched back from another app)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) fetchMedia();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchMedia]);

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
