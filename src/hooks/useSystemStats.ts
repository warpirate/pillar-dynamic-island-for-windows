import { useEffect, useRef, useState } from "react";
import { tauriInvoke } from "../lib/tauri";

export interface SystemStats {
  cpuPercent: number;
  memUsedMb: number;
  memTotalMb: number;
  memPercent: number;
}

/**
 * Polls system CPU/RAM usage from the backend — ONLY while `enabled`.
 *
 * Mirrors the app's polling discipline: the caller passes `enabled` (e.g. true
 * only when the Settings tab is open), so this does no background work while the
 * pill is collapsed or another tab is shown. CPU is a delta between refreshes, so
 * the first reading after enabling reads ~0 until the next poll lands.
 */
export function useSystemStats(enabled: boolean, intervalMs = 2500): { stats: SystemStats | null } {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      if (!mountedRef.current || pendingRef.current) return;
      pendingRef.current = true;
      try {
        const result = await tauriInvoke<SystemStats>("get_system_stats");
        if (mountedRef.current && result) setStats(result);
      } catch {
        // Backend unavailable (plain browser) or transient failure — ignore.
      } finally {
        pendingRef.current = false;
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, intervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [enabled, intervalMs]);

  return { stats };
}
