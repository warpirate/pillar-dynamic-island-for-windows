import { motion, AnimatePresence } from "motion/react";
import { useState, useCallback } from "react";
import type { VolumeInfo } from "../../../hooks/useVolume";
import type { BrightnessInfo } from "../../../hooks/useBrightness";
import type { AudioDevice } from "../../../hooks/useAudioDevices";
import type { AudioSession } from "../../../hooks/usePerAppMixer";
import { PerAppMixer } from "./PerAppMixer";

// =============================================================================
// Volume Slider
// =============================================================================

interface VolumeSliderProps {
  volume: VolumeInfo;
  onVolumeChange: (level: number) => void;
  onMuteToggle: () => void;
}

export function VolumeSlider({ volume, onVolumeChange, onMuteToggle }: VolumeSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localLevel, setLocalLevel] = useState(volume.level);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newLevel = parseInt(e.target.value, 10);
    setLocalLevel(newLevel);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      onVolumeChange(localLevel);
      setIsDragging(false);
    }
  }, [isDragging, localLevel, onVolumeChange]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Update local level when volume prop changes (from polling)
  const displayLevel = isDragging ? localLevel : volume.level;

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Mute button */}
      <motion.button
        className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-white flex-shrink-0"
        whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
        whileTap={{ scale: 0.95 }}
        onClick={onMuteToggle}
      >
        {volume.isMuted || displayLevel === 0 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12A4.5 4.5 0 0 0 14 8.11V2l-5 5H4v6h5l5 5v-6.11A4.5 4.5 0 0 0 16.5 12zM19 12l1.41-1.41-2.12-2.12L19 7.06l1.41 1.41L21.83 7.05l1.41 1.41L21.83 9.88l1.41 1.41-1.41 1.41-1.41-1.41-1.41 1.41z"/>
          </svg>
        ) : displayLevel < 50 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        )}
      </motion.button>

      {/* Slider */}
      <div className="flex-1 relative">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white/60 rounded-full"
            style={{ width: `${displayLevel}%` }}
            animate={{ width: `${displayLevel}%` }}
            transition={{ duration: isDragging ? 0 : 0.1 }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={displayLevel}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Level display */}
      <span className="text-white/90 text-[12px] w-7 text-right tabular-nums flex-shrink-0">
        {displayLevel}%
      </span>
    </div>
  );
}

// =============================================================================
// Brightness Slider
// =============================================================================

interface BrightnessSliderProps {
  brightness: BrightnessInfo;
  onBrightnessChange: (level: number) => void;
}

export function BrightnessSlider({ brightness, onBrightnessChange }: BrightnessSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localLevel, setLocalLevel] = useState(brightness.level);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newLevel = parseInt(e.target.value, 10);
    setLocalLevel(newLevel);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      onBrightnessChange(localLevel);
      setIsDragging(false);
    }
  }, [isDragging, localLevel, onBrightnessChange]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Update local level when brightness prop changes (from polling)
  const displayLevel = isDragging ? localLevel : brightness.level;

  // Brightness icon based on level
  const getBrightnessIcon = () => {
    if (displayLevel < 33) {
      // Low brightness - smaller sun
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    } else if (displayLevel < 66) {
      // Medium brightness
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-5.07l-1.41 1.41M8.34 15.66l-1.41 1.41m0-11.14l1.41 1.41m7.32 7.32l1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
      );
    } else {
      // High brightness - full sun
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v3m0 16v3m11-11h-3M4 12H1m18.07-7.07l-2.12 2.12M8.05 15.95l-2.12 2.12m0-12.02l2.12 2.12m7.9 7.9l2.12 2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
      );
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Brightness icon */}
      <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-amber-400/80 flex-shrink-0">
        {getBrightnessIcon()}
      </div>

      {/* Slider */}
      <div className="flex-1 relative">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-400/60 rounded-full"
            style={{ width: `${displayLevel}%` }}
            animate={{ width: `${displayLevel}%` }}
            transition={{ duration: isDragging ? 0 : 0.1 }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={displayLevel}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          disabled={!brightness.isSupported}
        />
      </div>

      {/* Level display */}
      <span className="text-white/90 text-[12px] w-7 text-right tabular-nums flex-shrink-0">
        {displayLevel}%
      </span>
    </div>
  );
}

// =============================================================================
// Toggle Switch Component
// =============================================================================

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}

function ToggleSwitch({ enabled, onToggle, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span className="text-white/90 text-[12px]">{label}</span>
        {description && (
          <span className="text-white/65 text-[11px]">{description}</span>
        )}
      </div>
      <motion.button
        className={`w-9 h-4 rounded-full p-0.5 transition-colors flex-shrink-0 ${
          enabled ? "bg-green-500/60" : "bg-white/10"
        }`}
        onClick={onToggle}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="w-3 h-3 rounded-full bg-white shadow-sm"
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </div>
  );
}

// =============================================================================
// Audio Device Selector
// =============================================================================

interface DeviceSelectorProps {
  devices: AudioDevice[];
  currentDevice: AudioDevice | null;
}

function DeviceSelector({ devices, currentDevice }: DeviceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get device icon based on name
  const getDeviceIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("headphone") || lowerName.includes("earphone")) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2a7 7 0 0 1 14 0v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z"/>
        </svg>
      );
    } else if (lowerName.includes("speaker")) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
      );
    } else {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      );
    }
  };

  if (devices.length <= 1) {
    // Single device - just show it without dropdown
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-1 bg-white/5 rounded-md">
        <span className="text-white/80 flex-shrink-0">
          {getDeviceIcon(currentDevice?.name || "")}
        </span>
        <span className="text-white/90 text-[12px] truncate flex-1 min-w-0">
          {currentDevice?.name || "No audio device"}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Current device button */}
      <motion.button
        className="w-full flex items-center gap-1.5 px-1.5 py-1 bg-white/5 rounded-md hover:bg-white/10 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-white/80">
          {getDeviceIcon(currentDevice?.name || "")}
        </span>
        <span className="text-white/90 text-[12px] truncate flex-1 text-left min-w-0">
          {currentDevice?.name || "Select device"}
        </span>
        <motion.svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="currentColor"
          className="text-white/70"
          animate={{ rotate: isOpen ? 180 : 0 }}
        >
          <path d="M7 10l5 5 5-5z"/>
        </motion.svg>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-0.5 bg-black/80 backdrop-blur-xl rounded-md border border-white/10 overflow-hidden z-10"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {devices.map((device) => (
              <button
                key={device.id}
                className={`w-full flex items-center gap-1.5 px-1.5 py-1 hover:bg-white/10 transition-colors ${
                  device.isDefault ? "bg-white/5" : ""
                }`}
                onClick={() => setIsOpen(false)}
              >
                <span className={`flex-shrink-0 ${device.isDefault ? "text-green-400" : "text-white/70"}`}>
                  {getDeviceIcon(device.name)}
                </span>
                <span className={`text-[12px] truncate flex-1 text-left min-w-0 ${
                  device.isDefault ? "text-white" : "text-white/85"
                }`}>
                  {device.name}
                </span>
                {device.isDefault && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-green-400/70">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Quick Settings Panel (Expanded View)
// =============================================================================

interface QuickSettingsProps {
  volume: VolumeInfo;
  onVolumeChange: (level: number) => void;
  onMuteToggle: () => void;
  brightness: BrightnessInfo;
  onBrightnessChange: (level: number) => void;
  audioDevices: AudioDevice[];
  defaultAudioDevice: AudioDevice | null;
  audioSessions: AudioSession[];
  onSessionVolumeChange: (processId: number, volume: number) => void;
  onSessionMuteToggle: (processId: number, muted: boolean) => void;
  autoStartEnabled: boolean;
  onAutoStartToggle: () => void;
}

export function QuickSettings({ 
  volume, 
  onVolumeChange, 
  onMuteToggle,
  brightness,
  onBrightnessChange,
  audioDevices,
  defaultAudioDevice,
  audioSessions,
  onSessionVolumeChange,
  onSessionMuteToggle,
  autoStartEnabled,
  onAutoStartToggle,
}: QuickSettingsProps) {
  const [showMixer, setShowMixer] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 py-0">
      {/* Audio output device */}
      <div className="flex flex-col gap-1">
        <span className="text-white/90 text-[12px]">Output</span>
        <DeviceSelector 
          devices={audioDevices}
          currentDevice={defaultAudioDevice}
        />
      </div>

      {/* Volume control */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-white/90 text-[12px]">Volume</span>
          <motion.button
            className={`text-[11px] px-1 py-0.5 rounded ${
              showMixer ? "bg-white/15 text-white/90" : "text-white/75 hover:text-white"
            }`}
            onClick={() => setShowMixer(!showMixer)}
            whileTap={{ scale: 0.95 }}
          >
            Mixer {audioSessions.length > 0 && `(${audioSessions.length})`}
          </motion.button>
        </div>
        <VolumeSlider
          volume={volume}
          onVolumeChange={onVolumeChange}
          onMuteToggle={onMuteToggle}
        />
      </div>

      {/* Per-app mixer (collapsible) */}
      <AnimatePresence>
        {showMixer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 rounded-lg p-1.5 mt-0.5">
              <span className="text-white/85 text-[11px] uppercase tracking-wider mb-0.5 block">
                App Volumes
              </span>
              <PerAppMixer
                sessions={audioSessions}
                onVolumeChange={onSessionVolumeChange}
                onMuteToggle={onSessionMuteToggle}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brightness control */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-white/90 text-[12px]">Brightness</span>
          {!brightness.isSupported && (
            <span className="text-white/65 text-[11px]">DDC/CI N/A</span>
          )}
        </div>
        <BrightnessSlider
          brightness={brightness}
          onBrightnessChange={onBrightnessChange}
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 my-0.5" />

      {/* Auto-start toggle */}
      <ToggleSwitch
        enabled={autoStartEnabled}
        onToggle={onAutoStartToggle}
        label="Start with Windows"
        description="Launch PILLAR when you log in"
      />
    </div>
  );
}
