import { motion } from "motion/react";
import { useState } from "react";
import type { AppearanceSettings, PillMode } from "../../../hooks/useAppearance";
import { ACCENT_PRESETS } from "../../../hooks/useAppearance";
import { microInteractions } from "../animations";

interface AppearanceModuleProps {
  settings: AppearanceSettings;
  onUpdate: (changes: Partial<AppearanceSettings>) => void;
  onSave: () => void;
  onReset: () => void;
  onBack: () => void;
}

export function AppearanceModule({ settings, onUpdate, onSave, onReset, onBack }: AppearanceModuleProps) {
  const [hoveredMode, setHoveredMode] = useState<PillMode | null>(null);

  return (
    <div className="flex flex-col gap-2.5 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <motion.button
          className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          onClick={onBack}
          {...microInteractions.button}
          aria-label="Back to settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </motion.button>
        <span className="text-white/90 text-[13px] font-medium">Appearance</span>
      </div>

      {/* Mode selector */}
      <div className="flex flex-col gap-1">
        <span className="text-white/50 text-[10px] uppercase tracking-wider font-medium">Style</span>
        <div className="flex gap-2">
          {(["island", "notch"] as const).map((m) => {
            const isSelected = settings.mode === m;
            const isHovered = hoveredMode === m;

            return (
              <motion.button
                key={m}
                className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-white/[0.12] ring-1 ring-white/20"
                    : "bg-white/5 hover:bg-white/[0.08]"
                }`}
                onMouseEnter={() => setHoveredMode(m)}
                onMouseLeave={() => setHoveredMode(null)}
                onClick={() => onUpdate({ mode: m })}
                whileTap={{ scale: 0.97 }}
              >
                <div
                  className="relative w-full flex justify-center"
                  style={{ height: 22, alignItems: m === "notch" ? "flex-start" : "center", display: "flex" }}
                >
                  {m === "notch" && (
                    <div className="absolute top-0 left-3 right-3 h-px bg-white/10" />
                  )}
                  <motion.div
                    style={{
                      position: "absolute",
                      top: m === "notch" ? 0 : "50%",
                      translateY: m === "island" ? "-50%" : 0,
                      background: "linear-gradient(135deg, rgba(20, 20, 22, 0.95), rgba(30, 30, 35, 0.9))",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                    animate={{
                      width: isHovered ? 56 : 44,
                      height: isHovered ? 14 : 11,
                      borderRadius: m === "island"
                        ? isHovered ? "7px" : "6px"
                        : isHovered ? "0 0 7px 7px" : "0 0 6px 6px",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isSelected ? "text-white" : "text-white/50"}`}>
                  {m === "island" ? "Island" : "Notch"}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Transparency slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-white/50 text-[10px] uppercase tracking-wider font-medium">Transparency</span>
          <span className="text-white/50 text-[10px] tabular-nums">{settings.opacity}%</span>
        </div>
        <div className="relative">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white/40 rounded-full"
              style={{ width: `${settings.opacity}%` }}
              animate={{ width: `${settings.opacity}%` }}
              transition={{ duration: 0.05 }}
            />
          </div>
          <input
            type="range"
            min="30"
            max="100"
            value={settings.opacity}
            onChange={(e) => onUpdate({ opacity: parseInt(e.target.value, 10) })}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label="Pill transparency"
            aria-valuemin={30}
            aria-valuemax={100}
            aria-valuenow={settings.opacity}
          />
        </div>
      </div>

      {/* Accent color */}
      <div className="flex flex-col gap-1.5">
        <span className="text-white/50 text-[10px] uppercase tracking-wider font-medium">Accent Color</span>
        <div className="flex gap-2 flex-wrap">
          {ACCENT_PRESETS.map((preset) => {
            const isActive = settings.accentColor === preset.value;
            return (
              <motion.button
                key={preset.value}
                className="relative w-6 h-6 rounded-full"
                style={{
                  background: preset.value,
                  boxShadow: isActive
                    ? `0 0 0 2px rgba(0,0,0,0.5), 0 0 0 3.5px rgba(255,255,255,0.4)`
                    : "0 0 0 1px rgba(255,255,255,0.1)",
                }}
                onClick={() => onUpdate({ accentColor: preset.value })}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`${preset.name} accent color`}
                title={preset.name}
              >
                {isActive && (
                  <svg
                    width="10" height="10" viewBox="0 0 24 24"
                    fill={preset.value === "#FFFFFF" ? "#000" : "#fff"}
                    className="absolute inset-0 m-auto"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex gap-2 pt-1.5 border-t border-white/5">
        <motion.button
          className="flex-1 py-1.5 rounded-md bg-white/5 text-white/50 text-[11px] font-medium hover:bg-white/10 hover:text-white/70 transition-colors"
          onClick={onReset}
          {...microInteractions.button}
        >
          Reset to Default
        </motion.button>
        <motion.button
          className="flex-1 py-1.5 rounded-md bg-white/15 text-white/90 text-[11px] font-medium hover:bg-white/20 transition-colors"
          onClick={onSave}
          {...microInteractions.button}
        >
          Save
        </motion.button>
      </div>
    </div>
  );
}
