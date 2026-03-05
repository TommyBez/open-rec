import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  ready: boolean;
}

export function StatusIndicator({ ready }: StatusIndicatorProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
      ready 
        ? "bg-primary/10 text-primary" 
        : "bg-muted/50 text-muted-foreground"
    )}>
      <div className={cn(
        "size-2 rounded-full transition-all duration-300",
        ready 
          ? "bg-primary animate-pulse shadow-[0_0_8px_oklch(0.62_0.24_25_/_0.6)]" 
          : "bg-muted-foreground/50"
      )} />
      {ready ? "Ready" : "Select Source"}
    </div>
  );
}
