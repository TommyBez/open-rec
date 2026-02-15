import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "../../../components/BrandLogo";

interface PermissionDeniedViewProps {
  onRequestPermission: () => void;
}

export function PermissionDeniedView({ onRequestPermission }: PermissionDeniedViewProps) {
  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_25)_0%,transparent_50%)] opacity-40" />
      <header className="relative z-10 mb-6 animate-fade-up">
        <BrandLogo />
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="animate-fade-up-delay-1 flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
          <Lock className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="animate-fade-up-delay-2 space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Permission Required
          </h2>
          <p className="text-sm text-muted-foreground">
            Open Rec needs access to record your screen.
          </p>
        </div>
        <Button
          size="lg"
          onClick={onRequestPermission}
          className="animate-fade-up-delay-3 mt-2 gap-2 bg-primary px-8 font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/25"
        >
          Grant Permission
        </Button>
        <p className="animate-fade-up-delay-4 mt-4 max-w-[280px] text-xs leading-relaxed text-muted-foreground/70">
          If the system dialog doesn&apos;t appear, go to{" "}
          <span className="font-medium text-foreground/80">
            System Settings → Privacy &amp; Security → Screen Recording
          </span>
        </p>
      </main>
    </div>
  );
}

export function PermissionLoadingView() {
  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_25)_0%,transparent_50%)] opacity-40" />
      <header className="relative z-10 mb-6 animate-fade-up">
        <BrandLogo />
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">Checking permissions...</p>
      </main>
    </div>
  );
}
