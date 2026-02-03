import { motion } from "motion/react";
import { useState, useCallback } from "react";
import type { AudioSession } from "../../../hooks/usePerAppMixer";

// =============================================================================
// Per-App Volume Slider
// =============================================================================

interface AppVolumeSliderProps {
  session: AudioSession;
  onVolumeChange: (processId: number, volume: number) => void;
  onMuteToggle: (processId: number, muted: boolean) => void;
}

function AppVolumeSlider({ session, onVolumeChange, onMuteToggle }: AppVolumeSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localVolume, setLocalVolume] = useState(session.volume);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10) / 100;
    setLocalVolume(newVolume);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      onVolumeChange(session.processId, localVolume);
      setIsDragging(false);
    }
  }, [isDragging, localVolume, onVolumeChange, session.processId]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const displayVolume = isDragging ? localVolume : session.volume;
  const displayPercent = Math.round(displayVolume * 100);

  // Get app icon - simple colored circle based on app name hash
  const getAppColor = (name: string) => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
      "bg-orange-500", "bg-cyan-500", "bg-red-500", "bg-yellow-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {/* App icon placeholder */}
      <div className={`w-5 h-5 rounded ${getAppColor(session.appName)} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[10px] font-bold uppercase">
          {session.appName.charAt(0)}
        </span>
      </div>

      {/* App name and controls */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Mute button */}
          <motion.button
            className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
              session.isMuted ? "bg-red-500/30 text-red-400" : "bg-white/5 text-white/80"
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onMuteToggle(session.processId, !session.isMuted)}
          >
            {session.isMuted ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12A4.5 4.5 0 0 0 14 8.11V2l-5 5H4v6h5l5 5v-6.11A4.5 4.5 0 0 0 16.5 12zM19 12l1.41-1.41-2.12-2.12L19 7.06l1.41 1.41L21.83 7.05l1.41 1.41L21.83 9.88l1.41 1.41-1.41 1.41-1.41-1.41-1.41 1.41z"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            )}
          </motion.button>

          {/* App name */}
          <span className={`text-[12px] truncate flex-1 ${
            session.isActive ? "text-white/95" : "text-white/75"
          }`}>
            {session.appName}
          </span>

          {/* Volume percent */}
          <span className="text-[11px] text-white/80 w-6 text-right tabular-nums">
            {displayPercent}%
          </span>
        </div>

        {/* Slider */}
        <div className="relative mt-0.5">
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                session.isMuted ? "bg-white/20" : session.isActive ? "bg-white/50" : "bg-white/30"
              }`}
              style={{ width: `${displayPercent}%` }}
              animate={{ width: `${displayPercent}%` }}
              transition={{ duration: isDragging ? 0 : 0.1 }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={displayPercent}
            onChange={handleChange}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Per-App Mixer Panel
// =============================================================================

interface PerAppMixerProps {
  sessions: AudioSession[];
  onVolumeChange: (processId: number, volume: number) => void;
  onMuteToggle: (processId: number, muted: boolean) => void;
}

export function PerAppMixer({ sessions, onVolumeChange, onMuteToggle }: PerAppMixerProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-2 text-white/75">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mb-1 opacity-80">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
        <span className="text-[12px]">No apps playing audio</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto pr-0.5">
      {sessions.map((session) => (
        <AppVolumeSlider
          key={session.processId}
          session={session}
          onVolumeChange={onVolumeChange}
          onMuteToggle={onMuteToggle}
        />
      ))}
    </div>
  );
}
