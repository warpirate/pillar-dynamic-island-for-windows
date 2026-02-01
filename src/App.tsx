import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Pill } from "./components/Pill/Pill";

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const positionWindow = async () => {
      if (window.__TAURI__) {
        try {
          await window.__TAURI__.invoke("position_window");
        } catch (e) {
          console.error("Failed to position window:", e);
        }
      }
    };
    positionWindow();
  }, []);

  // Poll for fullscreen (desktop only): pill animates up when something is fullscreen, down when exit
  useEffect(() => {
    if (!window.__TAURI__) return;
    const check = async () => {
      try {
        const fullscreen = await window.__TAURI__!.invoke("is_foreground_fullscreen") as boolean;
        setIsFullscreen(fullscreen);
      } catch {
        // ignore
      }
    };
    check();
    const id = setInterval(check, 800);
    return () => clearInterval(id);
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
