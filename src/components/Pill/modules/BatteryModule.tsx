import { motion, AnimatePresence } from "motion/react";
import type { BatteryInfo } from "../../../hooks/useBattery";
import { idleSlotAnimations } from "../animations";

// =============================================================================
// Battery Indicator (idle pill — compact icon only, hover shows %)
// =============================================================================

interface BatteryIndicatorProps {
  battery: BatteryInfo;
  isLow: boolean;
  isCritical: boolean;
  showPercent?: boolean; // true on hover
}

function getBatteryColor(battery: BatteryInfo, isLow: boolean, isCritical: boolean): string {
  if (battery.isCharging) return "#22c55e"; // green
  if (isCritical) return "#ef4444";          // red
  if (isLow) return "#f59e0b";               // amber
  return "#ffffff99";                         // white/60
}

function BatteryIcon({ battery, isLow, isCritical }: Omit<BatteryIndicatorProps, "showPercent">) {
  const color = getBatteryColor(battery, isLow, isCritical);
  // Fill bar: 1-10px inside the battery body (12px inner width)
  const fillWidth = Math.max(1, Math.round((battery.percent / 100) * 10));

  return (
    <svg width="18" height="11" viewBox="0 0 20 11" fill="none" aria-hidden="true">
      {/* Battery body */}
      <rect x="0.5" y="0.5" width="15" height="10" rx="2" stroke={color} strokeWidth="1" fill="none" />
      {/* Battery tip */}
      <rect x="16.5" y="3" width="2.5" height="5" rx="1" fill={color} opacity={0.5} />
      {/* Fill level */}
      <rect x="2" y="2" width={fillWidth} height="7" rx="1" fill={color} />
      {/* Charging bolt — thick, high-contrast */}
      {battery.isCharging && (
        <g>
          {/* Dark outline for contrast */}
          <path
            d="M9.5 0.5L6 5.5H9L6.5 10.5"
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Bright yellow bolt */}
          <path
            d="M9.5 0.5L6 5.5H9L6.5 10.5"
            stroke="#facc15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      )}
    </svg>
  );
}

export function BatteryIndicator({ battery, isLow, isCritical, showPercent = false }: BatteryIndicatorProps) {
  if (!battery.hasBattery) return null;

  const color = getBatteryColor(battery, isLow, isCritical);

  return (
    <motion.div
      className="relative flex items-center gap-0.5"
      initial={idleSlotAnimations.right.initial}
      animate={idleSlotAnimations.right.animate}
      exit={idleSlotAnimations.right.exit}
      transition={idleSlotAnimations.transition}
    >
      {/* Pulsing glow when critical */}
      <AnimatePresence>
        {isCritical && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(239, 68, 68, 0.3)",
                "0 0 8px 2px rgba(239, 68, 68, 0.15)",
                "0 0 0 0 rgba(239, 68, 68, 0.3)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      <BatteryIcon battery={battery} isLow={isLow} isCritical={isCritical} />

      {/* Percentage text — fades in on hover (pill has already widened by then) */}
      <AnimatePresence>
        {showPercent && (
          <motion.span
            className="text-[11px] font-semibold tabular-nums leading-none whitespace-nowrap"
            style={{ color, fontVariantNumeric: "tabular-nums" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {battery.percent}%
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
