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

function getInvoker(): TauriInvoke | null {
  const invoke = window.__TAURI__?.core?.invoke;
  return invoke ?? null;
}

export function isTauriAvailable(): boolean {
  return getInvoker() !== null;
}

export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  const invoke = getInvoker();
  if (!invoke) return null;

  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`Tauri invoke failed (${cmd}):`, error);
    // Rethrow so callers (e.g. usePrismAI) can show the backend error message
    throw error;
  }
}
