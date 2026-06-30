import { useSystemStats } from "../../../hooks/useSystemStats";
import { hexToRgba } from "../../../hooks/useAppearance";

interface SystemMonitorProps {
  /** Poll only while true (e.g. the Settings tab is open). */
  enabled: boolean;
  accentColor: string;
}

interface StatBarProps {
  label: string;
  /** 0..100 */
  percent: number;
  valueText: string;
  accentColor: string;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function StatBar({ label, percent, valueText, accentColor }: StatBarProps) {
  const pct = clampPercent(percent);
  // Shift toward red as load climbs so a glance reads "busy" without needing color
  // literacy — paired with the always-present numeric value for non-color users.
  const hot = pct >= 85;
  const fill = hot ? "#ef4444" : accentColor;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/70">{label}</span>
        <span className="text-white/90 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
          {valueText}
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={valueText}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${hexToRgba(fill, 0.65)}, ${fill})`,
          }}
        />
      </div>
    </div>
  );
}

export function SystemMonitor({ enabled, accentColor }: SystemMonitorProps) {
  const { stats } = useSystemStats(enabled);

  const cpu = stats ? stats.cpuPercent : 0;
  const memPct = stats ? stats.memPercent : 0;
  const memText = stats
    ? `${(stats.memUsedMb / 1024).toFixed(1)} / ${(stats.memTotalMb / 1024).toFixed(1)} GB`
    : "—";

  return (
    <section
      className="rounded-pill-md bg-white/5 border border-white/10 p-3 mb-2"
      aria-label="System monitor"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/80 text-[11px] uppercase tracking-wider">System</span>
        {!stats && <span className="text-white/40 text-[10px]">reading…</span>}
      </div>
      <div className="flex flex-col gap-2.5">
        <StatBar
          label="CPU"
          percent={cpu}
          valueText={stats ? `${Math.round(cpu)}%` : "—"}
          accentColor={accentColor}
        />
        <StatBar
          label="Memory"
          percent={memPct}
          valueText={stats ? `${Math.round(memPct)}% · ${memText}` : "—"}
          accentColor={accentColor}
        />
      </div>
    </section>
  );
}
