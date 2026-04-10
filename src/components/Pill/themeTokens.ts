import type { AppearanceSettings } from "../../hooks/useAppearance";
import type { MotionSettingsData } from "../../hooks/useSettings";

export interface PillThemeTokens {
  surfacePrimary: string;
  surfaceSecondary: string;
  borderColor: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  shadow: string;
}

export function resolveReducedMotion(override: MotionSettingsData["reduced_motion_override"]): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createPillThemeTokens(appearance: AppearanceSettings): PillThemeTokens {
  const opacity = appearance.opacity / 100;
  const accent = appearance.accentColor;
  return {
    surfacePrimary: `rgba(20, 20, 22, ${opacity})`,
    surfaceSecondary: `rgba(30, 30, 35, ${Math.min(1, opacity * 0.95)})`,
    borderColor: "rgba(255,255,255,0.12)",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.65)",
    accent,
    accentSoft: `color-mix(in srgb, ${accent} 25%, transparent)`,
    shadow: "0 4px 24px rgba(0, 0, 0, 0.25)",
  };
}
