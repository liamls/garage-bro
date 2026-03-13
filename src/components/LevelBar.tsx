interface LevelBarProps {
  level: number; // 0–1
  isActive: boolean;
}

/** Thin horizontal bar showing signal level, sits at the bottom of a pedal */
export function LevelBar({ level, isActive }: LevelBarProps) {
  const pct = Math.round(level * 100);
  const color =
    level > 0.85
      ? "#f87171"
      : level > 0.65
        ? "#e8900a"
        : "rgba(232,144,10,0.6)";

  return (
    <div
      style={{
        width: "100%",
        height: "3px",
        borderRadius: "2px",
        background: "rgba(0,0,0,0.4)",
        overflow: "hidden",
        marginTop: "2px",
      }}
    >
      <div
        style={{
          width: isActive ? `${pct}%` : "0%",
          height: "100%",
          background: color,
          borderRadius: "2px",
          transition: "width 80ms linear, background 200ms",
          boxShadow: isActive && level > 0.1 ? `0 0 4px ${color}` : "none",
        }}
      />
    </div>
  );
}
