import { useCallback, useEffect, useRef } from "react";

/** Ceiling of one backend call per this window while a slider is driven continuously. */
export const SLIDER_COMMIT_INTERVAL_MS = 100;

interface ThrottledCommit {
  /** Throttled commit: leading edge fires now, the rest coalesce. */
  send: (value: number) => void;
  /** Commit now, cancelling any throttled call still in flight. */
  sendNow: (value: number) => void;
}

/**
 * Leading-plus-trailing throttle for slider commits.
 *
 * A held arrow key auto-repeats around 30x/sec, and the brightness slider
 * commits on every pointer sample; each of those became its own backend call,
 * which for DDC/CI writes is far slower than the events arrive. This fires the
 * first value immediately so the control still feels instant, then at most one
 * further call per interval, always ending on the latest value.
 */
export function useThrottledCommit(
  commit: (value: number) => void,
  intervalMs = SLIDER_COMMIT_INTERVAL_MS
): ThrottledCommit {
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (pending === null) {
      timerRef.current = null;
      return;
    }
    pendingRef.current = null;
    commitRef.current(pending);
    timerRef.current = setTimeout(flush, intervalMs);
  }, [intervalMs]);

  const send = useCallback((value: number) => {
    if (timerRef.current !== null) {
      pendingRef.current = value;
      return;
    }
    commitRef.current(value);
    timerRef.current = setTimeout(flush, intervalMs);
  }, [flush, intervalMs]);

  const sendNow = useCallback((value: number) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    commitRef.current(value);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return { send, sendNow };
}
