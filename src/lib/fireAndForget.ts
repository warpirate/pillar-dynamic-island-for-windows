import { createLogger } from "./logger";

const log = createLogger("ui");

/**
 * Swallow the rejection of a promise we deliberately don't await.
 *
 * The settings hooks re-throw when a persist fails so callers *can* react, but
 * the UI handlers that trigger them are fire-and-forget. Left unhandled, that
 * rejection reaches the global `unhandledrejection` listener in main.tsx and is
 * filed as a crash report — which pollutes crash history and counts toward the
 * crash-loop guard that suspends auto-recovery for genuine crashes.
 *
 * The originating hook already logs the underlying error; this records which
 * user action was in flight when it happened.
 */
export function fireAndForget(promise: Promise<unknown>, action: string): void {
  promise.catch((e) => log.warn(`${action} failed`, e));
}
