import { cn } from "@/lib/utils";

interface SourceTypeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

export function SourceTypeButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: SourceTypeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
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
