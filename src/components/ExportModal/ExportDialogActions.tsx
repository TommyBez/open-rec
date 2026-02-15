import { Button } from "@/components/ui/button";

type ExportStatus = "idle" | "exporting" | "complete" | "error";

interface ExportDialogActionsProps {
  exportStatus: ExportStatus;
  jobId: string | null;
  onClose: () => void;
  onRetry: () => void;
  onCancelExport: () => void;
}

export function ExportDialogActions({
  exportStatus,
  jobId,
  onClose,
  onRetry,
  onCancelExport,
}: ExportDialogActionsProps) {
  if (exportStatus === "idle") {
    return (
      <div className="flex w-full justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onRetry}>Export</Button>
      </div>
    );
  }

  if (exportStatus === "exporting") {
    return (
      <div className="flex w-full justify-end">
        <Button variant="outline" onClick={onCancelExport} disabled={!jobId}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-end gap-2">
      {exportStatus === "error" && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
      <Button onClick={onClose}>{exportStatus === "complete" ? "Done" : "Close"}</Button>
    </div>
  );
}
