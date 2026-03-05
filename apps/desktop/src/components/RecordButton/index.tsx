import { cn } from "@/lib/utils";

interface RecordButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export function RecordButton({ onClick, disabled }: RecordButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center justify-center gap-3 rounded-xl px-6 py-4 font-semibold transition-all duration-200",
        disabled
          ? "cursor-not-allowed bg-muted text-muted-foreground opacity-50"
          : "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-[0.98]"
      )}
    >
      {/* Record indicator dot */}
      <div className={cn(
        "size-2.5 rounded-full transition-colors",
        disabled ? "bg-muted-foreground/50" : "bg-white"
      )} />
      <span className="text-sm tracking-tight">Start Recording</span>
    </button>
  );
}
