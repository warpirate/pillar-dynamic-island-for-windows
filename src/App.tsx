import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { Pill } from "./components/Pill/Pill";
import { isTauriAvailable, tauriInvoke } from "./lib/tauri";

function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (!isTauriAvailable()) return;

    let isMounted = true;
    const checkFullscreen = async () => {
      if (!isMounted) return;
      
      try {
        const fullscreen = await tauriInvoke<boolean>("is_foreground_fullscreen");
        if (isMounted && fullscreen !== null && fullscreen !== lastFullscreenState.current) {
          lastFullscreenState.current = fullscreen;
          setIsFullscreen(fullscreen);
        }
      } catch (error) {
        // Silently handle Tauri invoke errors to prevent crashes
        if (isMounted) {
          console.warn('Fullscreen check failed:', error);
        }
      }
    };

    // Initial check
    checkFullscreen();

    const POLL_MS = 300; // Fast response when entering/leaving fullscreen
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(checkFullscreen, POLL_MS);
      fullscreenCheckRef.current = intervalId;
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
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
      isMounted = false;
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
