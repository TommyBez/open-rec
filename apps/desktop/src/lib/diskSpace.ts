import { DiskSpaceStatus } from "../types/project";

const FALLBACK_MINIMUM_FREE_BYTES = 5 * 1024 ** 3;

export function formatBytesAsGiB(bytes: number): string {
  return (bytes / (1024 ** 3)).toFixed(2);
}

export function resolveMinimumFreeBytes(status: DiskSpaceStatus): number {
  return status.minimumRequiredBytes ?? FALLBACK_MINIMUM_FREE_BYTES;
}
