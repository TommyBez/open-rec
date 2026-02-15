export type RecordingFinalizingStatus =
  | "stopping-capture"
  | "concatenating-segments"
  | "verifying-duration"
  | "verifying-dimensions"
  | "saving-project"
  | "refreshing-ui";

export function getRecordingFinalizingMessage(
  status: RecordingFinalizingStatus | null
): string {
  if (status === "stopping-capture") {
    return "Stopping active capture streams…";
  }
  if (status === "concatenating-segments") {
    return "Finalizing recording segments…";
  }
  if (status === "verifying-duration") {
    return "Verifying recording duration…";
  }
  if (status === "verifying-dimensions") {
    return "Verifying recording resolution…";
  }
  if (status === "saving-project") {
    return "Saving project metadata…";
  }
  if (status === "refreshing-ui") {
    return "Refreshing recorder views…";
  }
  return "Stopping recording…";
}

export function getRecordingWidgetStatusLabel(
  status: RecordingFinalizingStatus | null
): string {
  if (status === "stopping-capture") {
    return "Stopping";
  }
  if (status === "concatenating-segments") {
    return "Merging";
  }
  if (status === "verifying-duration" || status === "verifying-dimensions") {
    return "Verifying";
  }
  if (status === "saving-project") {
    return "Saving";
  }
  if (status === "refreshing-ui") {
    return "Syncing";
  }
  return "Stopping";
}
