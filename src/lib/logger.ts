/**
 * Centralized logger. Single point of control for log routing, level filtering,
 * and forwarding to the Tauri backend (so logs survive across app restarts).
 *
 * - In dev: prints to the browser/Tauri webview console.
 * - In production: only WARN and ERROR are printed; INFO/DEBUG are dropped.
 *   ERROR is also forwarded to the Rust backend via the `log_frontend_error`
 *   command if it exists; missing command is a silent no-op so the logger
 *   never throws.
 *
 * Never import this from inside `src/lib/tauri.ts` (cyclic).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const IS_PROD = (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel = IS_PROD ? "warn" : "debug";

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[MIN_LEVEL];
}

function format(scope: string, message: string): string {
  return `[${scope}] ${message}`;
}

// Lazy import the tauri invoker without depending on `lib/tauri.ts` (avoids cycles).
function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & {
    __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };
  };
  return win.__TAURI__?.core?.invoke ?? null;
}

function forwardToBackend(scope: string, message: string, detail?: unknown): void {
  const invoke = getTauriInvoke();
  if (!invoke) return;
  // Backend command is optional; missing implementations should not throw.
  invoke("log_frontend_error", {
    payload: {
      scope,
      message,
      detail: detail === undefined ? null : safeSerialize(detail),
      timestamp: Date.now(),
    },
  }).catch(() => {
    // Backend command not registered — silent fallback, the console still has the entry.
  });
}

function safeSerialize(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({ name: value.name, message: value.message, stack: value.stack });
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface Logger {
  debug: (message: string, detail?: unknown) => void;
  info: (message: string, detail?: unknown) => void;
  warn: (message: string, detail?: unknown) => void;
  error: (message: string, detail?: unknown) => void;
}

export function createLogger(scope: string): Logger {
  return {
    debug(message, detail) {
      if (!shouldEmit("debug")) return;
      if (detail !== undefined) console.debug(format(scope, message), detail);
      else console.debug(format(scope, message));
    },
    info(message, detail) {
      if (!shouldEmit("info")) return;
      if (detail !== undefined) console.info(format(scope, message), detail);
      else console.info(format(scope, message));
    },
    warn(message, detail) {
      if (!shouldEmit("warn")) return;
      if (detail !== undefined) console.warn(format(scope, message), detail);
      else console.warn(format(scope, message));
    },
    error(message, detail) {
      if (!shouldEmit("error")) return;
      if (detail !== undefined) console.error(format(scope, message), detail);
      else console.error(format(scope, message));
      forwardToBackend(scope, message, detail);
    },
  };
}

export const rootLogger = createLogger("pillar");
