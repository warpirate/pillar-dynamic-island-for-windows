import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { Pill } from "./components/Pill/Pill";

// Tauri invoke helper - Tauri v2 uses window.__TAURI__.core.invoke
const tauriInvoke = async <T,>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  if (!(window as any).__TAURI__?.core?.invoke) return null;
  try {
    return await (window as any).__TAURI__.core.invoke(cmd, args) as T;
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

  // Fullscreen detection: poll frequently so pill hides/shows with no noticeable delay
  useEffect(() => {
    if (!(window as any).__TAURI__?.core?.invoke) return;

    const checkFullscreen = async () => {
      const fullscreen = await tauriInvoke<boolean>("is_foreground_fullscreen");
      if (fullscreen !== null && fullscreen !== lastFullscreenState.current) {
        lastFullscreenState.current = fullscreen;
        setIsFullscreen(fullscreen);
      }
    };

    // Initial check
    checkFullscreen();

    const POLL_MS = 300; // Fast response when entering/leaving fullscreen
    const startPolling = () => {
      if (fullscreenCheckRef.current) clearInterval(fullscreenCheckRef.current);
      fullscreenCheckRef.current = setInterval(checkFullscreen, POLL_MS);
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
