import type { ReactNode } from "react";

interface TrackLabelProps {
  label: string;
  icon: ReactNode;
}

export function TrackLabel({ label, icon }: TrackLabelProps) {
  return (
    <div className="flex h-10 items-center gap-1.5 text-muted-foreground/60">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}
