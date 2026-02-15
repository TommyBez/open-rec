import { XCircle } from "lucide-react";
import { motion } from "motion/react";

interface ExportErrorCardProps {
  error: string | null;
}

export function ExportErrorCard({ error }: ExportErrorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="flex w-full flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-5 shadow-lg"
    >
      <div className="flex items-center gap-2.5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 15 }}
        >
          <XCircle className="size-5 text-destructive" />
        </motion.div>
        <span className="text-sm font-medium text-foreground">Export failed</span>
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs text-destructive/80"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
