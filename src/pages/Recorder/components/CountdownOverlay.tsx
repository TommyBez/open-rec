interface CountdownOverlayProps {
  value: number;
}

export function CountdownOverlay({ value }: CountdownOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/40 backdrop-blur-sm">
      <span className="text-7xl font-semibold tracking-tight text-white drop-shadow-lg">
        {value}
      </span>
      <span className="text-xs text-white/80">Press Esc to cancel</span>
    </div>
  );
}
