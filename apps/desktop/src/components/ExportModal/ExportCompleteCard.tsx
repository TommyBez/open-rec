import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface ExportCompleteCardProps {
  outputPath: string | null;
}

export function ExportCompleteCard({ outputPath }: ExportCompleteCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="flex w-full flex-col gap-3 rounded-xl border border-chart-3/20 bg-chart-3/10 p-5 shadow-lg"
    >
      <div className="flex items-center gap-2.5">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 15 }}
        >
          <CheckCircle2 className="size-5 text-chart-3" />
        </motion.div>
        <span className="text-sm font-medium text-foreground">Export complete</span>
      </div>
      {outputPath && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="truncate font-mono text-xs text-muted-foreground"
          title={outputPath}
        >
          {outputPath}
        </motion.p>
      )}
    </motion.div>
  );
}
