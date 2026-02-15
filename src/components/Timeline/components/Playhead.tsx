interface PlayheadProps {
  playheadPosition: number;
}

export function Playhead({ playheadPosition }: PlayheadProps) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{ left: `${playheadPosition}%` }}
    >
      <div
        className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 bg-primary shadow-[0_0_8px_oklch(0.62_0.24_25_/_0.6)]"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)" }}
      />
      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_6px_oklch(0.62_0.24_25_/_0.5)]" />
    </div>
  );
}
