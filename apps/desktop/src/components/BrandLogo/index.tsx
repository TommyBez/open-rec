export function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Custom logo mark - stylized "rec" indicator */}
      <div className="relative flex size-10 items-center justify-center">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5" />
        <div className="relative size-4 rounded-full bg-primary shadow-lg" style={{ boxShadow: '0 0 12px oklch(0.62 0.24 25 / 0.5)' }} />
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-semibold tracking-tight text-foreground">
          Open Rec
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
          Studio
        </span>
      </div>
    </div>
  );
}
