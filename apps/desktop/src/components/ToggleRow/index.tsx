import { Camera, Mic, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToggleRowProps {
  icon: "camera" | "microphone" | "speaker";
  label: string;
  sublabel?: string;
  enabled: boolean;
  onToggle: () => void;
}

const iconComponents = {
  camera: Camera,
  microphone: Mic,
  speaker: Volume2,
};

export function ToggleRow({ icon, label, sublabel, enabled, onToggle }: ToggleRowProps) {
  const Icon = iconComponents[icon];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-200",
        "border border-transparent",
        enabled
          ? "bg-card/80 border-primary/20 shadow-sm"
          : "bg-card/40 hover:bg-card/60"
      )}
    >
      {/* Icon with indicator glow */}
      <div className={cn(
        "relative flex size-9 items-center justify-center rounded-lg transition-all duration-200",
        enabled
          ? "bg-primary/15"
          : "bg-muted/50"
      )}>
        <Icon
          className={cn(
            "size-[18px] transition-all duration-200",
            enabled ? "text-primary" : "text-muted-foreground"
          )}
          strokeWidth={1.75}
        />
        {/* Active indicator dot */}
        {enabled && (
          <div className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary shadow-[0_0_6px_oklch(0.62_0.24_25_/_0.5)]" />
        )}
      </div>
      
      {/* Labels */}
      <div className="flex flex-1 flex-col">
        <span className={cn(
          "text-sm font-medium transition-colors duration-200",
          enabled ? "text-foreground" : "text-foreground/80"
        )}>
          {label}
        </span>
        {sublabel && (
          <span className={cn(
            "text-[11px] transition-colors duration-200",
            enabled 
              ? "text-primary/70" 
              : "text-muted-foreground/60"
          )}>
            {sublabel}
          </span>
        )}
      </div>
      
      {/* Custom toggle switch */}
      <div className={cn(
        "relative h-6 w-11 rounded-full transition-all duration-200",
        enabled
          ? "bg-primary shadow-[0_0_10px_oklch(0.62_0.24_25_/_0.3)]"
          : "bg-muted"
      )}>
        <div className={cn(
          "absolute top-1 size-4 rounded-full bg-white shadow-md transition-all duration-200",
          enabled ? "left-6" : "left-1"
        )} />
      </div>
    </button>
  );
}
