"use client";

/**
 * The theme's CSS was built for an audio waveform (see `.bar-stagger`,
 * `--wave-color`, `--wave-progress`, `bar-breathe` in globals.css). It reads
 * naturally as a *signal* — which is what a reputation record actually is:
 * a running signal of completed work. This component is that idea made
 * literal, and it's reused in two places:
 *
 *  - `mode="ambient"` on the landing page hero, all bars breathing, purely
 *    atmospheric
 *  - `mode="progress"` on the contract page and profile page, where bars
 *    up to `active` light up in the accent color and the rest sit dim —
 *    a real reading of the data, not decoration
 */
export function TrustPulse({
  bars = 16,
  active,
  mode = "ambient",
  className = "",
}: {
  bars?: number;
  active?: number;
  mode?: "ambient" | "progress";
  className?: string;
}) {
  return (
    <div
      className={`bar-stagger flex items-end gap-0.75 h-10 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = mode === "progress" && active !== undefined && i < active;
        return (
          <div
            key={i}
            className={`w-0.75 rounded-full origin-bottom ${
              mode === "ambient" ? "animate-bar-breathe" : ""
            }`}
            style={{
              background: isActive || mode === "ambient" ? "var(--wave-progress)" : "var(--border-bright)",
              opacity: mode === "progress" && !isActive ? 0.35 : undefined,
              transition: "background 0.4s ease, opacity 0.4s ease",
            }}
          />
        );
      })}
    </div>
  );
}
