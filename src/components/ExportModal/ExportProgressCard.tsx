import { motion } from "motion/react";
import { formatDuration } from "./exportModalUtils";

interface ExportProgressCardProps {
  progress: number;
  currentTime: number;
  displayDuration: number;
  formatLabel: string;
  resolutionLabel?: string;
}

export function ExportProgressCard({
  progress,
  currentTime,
  displayDuration,
  formatLabel,
  resolutionLabel,
}: ExportProgressCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="studio-panel flex w-full flex-col gap-4 rounded-xl p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <motion.span
            className="relative flex size-2.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
          </motion.span>
          <span className="text-sm font-medium text-foreground/80">Encoding</span>
        </div>
        <motion.span
          key={Math.round(progress)}
          initial={{ opacity: 0.5, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="font-mono text-2xl font-semibold tracking-tight text-foreground"
        >
          {Math.round(progress)}
          <span className="text-base text-foreground/50">%</span>
        </motion.span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent glow-amber"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
          }}
          animate={{
            backgroundPosition: ["200% 0%", "-200% 0%"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatDuration(currentTime)}
          <span className="text-muted-foreground/50"> / </span>
          {formatDuration(displayDuration)}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {formatLabel}
          {resolutionLabel ? ` • ${resolutionLabel}` : ""}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/80">
        You can close this dialog and continue editing while export runs in background.
      </p>
    </motion.div>
  );
}
