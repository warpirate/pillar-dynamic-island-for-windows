import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { Pill } from "./components/Pill/Pill";

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

// Tauri invoke helper with error handling
const tauriInvoke = async <T,>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  if (!window.__TAURI__) return null;
  try {
    return await window.__TAURI__.invoke(cmd, args) as T;
  } catch (e) {
    console.error(`Tauri invoke failed (${cmd}):`, e);
    return null;
  }
};

function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFullscreenState = useRef(false);

  // Position window on mount and handle display changes
  useEffect(() => {
    const positionWindow = () => tauriInvoke("position_window");
    positionWindow();

    // Listen for display/resolution changes
    const handleResize = () => {
      positionWindow();
    };

    // Reposition when window regains focus (handles monitor switches)
    const handleFocus = () => {
      positionWindow();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // OPTIMIZED: Adaptive polling for fullscreen detection
  // - Checks less frequently (2.5s) when state is stable
  // - Uses visibility API to pause when tab/window hidden
  useEffect(() => {
    if (!window.__TAURI__) return;

    const checkFullscreen = async () => {
      const fullscreen = await tauriInvoke<boolean>("is_foreground_fullscreen");
      if (fullscreen !== null && fullscreen !== lastFullscreenState.current) {
        lastFullscreenState.current = fullscreen;
        setIsFullscreen(fullscreen);
      }
    };

    // Initial check
    checkFullscreen();

    // Adaptive polling - longer interval since fullscreen changes are infrequent
    const startPolling = () => {
      if (fullscreenCheckRef.current) clearInterval(fullscreenCheckRef.current);
      fullscreenCheckRef.current = setInterval(checkFullscreen, 2500);
    };

    const stopPolling = () => {
      if (fullscreenCheckRef.current) {
        clearInterval(fullscreenCheckRef.current);
        fullscreenCheckRef.current = null;
      }
    };

    // Pause polling when document is hidden (saves CPU when minimized)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        checkFullscreen(); // Immediate check when becoming visible
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <motion.div
      className="w-full h-screen flex items-start justify-center pt-0"
      style={{ minHeight: "100vh", overflow: "visible" }}
      animate={{ y: isFullscreen ? -280 : 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      <Pill />
    </motion.div>
  );
}

export default App;
