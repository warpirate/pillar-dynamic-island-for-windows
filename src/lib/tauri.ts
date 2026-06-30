import { createLogger } from "./logger";

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

interface TauriCoreApi {
  invoke: TauriInvoke;
}

interface TauriApi {
  core?: TauriCoreApi;
}

declare global {
  interface Window {
    __TAURI__?: TauriApi;
  }
}

const log = createLogger("tauri");

/** Default per-invoke timeout. Backend commands that legitimately take longer
 *  (heavy COM operations, large backups) should pass an explicit `timeoutMs`. */
const DEFAULT_INVOKE_TIMEOUT_MS = 10_000;

export interface InvokeOptions {
  /** Override the default timeout in ms. Pass `0` to disable the timeout. */
  timeoutMs?: number;
  /** Suppress error logging for expected/recoverable failures. */
  silent?: boolean;
}

/** Distinguishable error types so callers can branch on the failure mode. */
export class TauriUnavailableError extends Error {
  constructor() {
    super("Tauri runtime not available (likely running in a plain browser).");
    this.name = "TauriUnavailableError";
  }
}

export class TauriTimeoutError extends Error {
  constructor(cmd: string, timeoutMs: number) {
    super(`Tauri command "${cmd}" timed out after ${timeoutMs}ms.`);
    this.name = "TauriTimeoutError";
  }
}

function getInvoker(): TauriInvoke | null {
  const invoke = window.__TAURI__?.core?.invoke;
  return invoke ?? null;
}

export function isTauriAvailable(): boolean {
  return getInvoker() !== null;
}

/**
 * Invoke a Tauri backend command.
 *
 * Returns `null` in two cases:
 *   1. Tauri runtime is not present (dev in plain browser). Use {@link isTauriAvailable}
 *      first if you need to distinguish this from a legitimate `null` result.
 *   2. The command threw — the error is logged and re-thrown so callers can catch.
 *      (Callers that prefer "best effort" should wrap in try/catch and ignore.)
 *
 * Throws {@link TauriTimeoutError} if the command does not resolve within the
 * configured timeout. The Rust call will keep running on the backend, but the
 * frontend stops waiting so UI doesn't hang.
 */
export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<T | null> {
  const invoke = getInvoker();
  if (!invoke) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_INVOKE_TIMEOUT_MS;

  try {
    if (timeoutMs <= 0) {
      return await invoke<T>(cmd, args);
    }
    return await withTimeout(invoke<T>(cmd, args), timeoutMs, cmd);
  } catch (error) {
    if (!options.silent) {
      log.error(`invoke failed: ${cmd}`, error);
    }
    throw error;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, cmd: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => {
      reject(new TauriTimeoutError(cmd, ms));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(handle);
        resolve(value);
      },
      (err) => {
        clearTimeout(handle);
        reject(err);
      }
    );
  });
}
