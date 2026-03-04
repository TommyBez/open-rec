import { cn } from "@/lib/utils";

interface SourceTypeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

export function SourceTypeButton({ 
  active, 
  onClick, 
  icon, 
  label,
  disabled = false,
}: SourceTypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-card text-foreground shadow-md"
          : "text-muted-foreground hover:text-foreground/80"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
