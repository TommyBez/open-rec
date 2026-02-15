export const QUICK_RECORD_REQUEST_STORAGE_KEY = "openrec.quickRecordRequested";

export function requestTrayQuickRecord(): void {
  sessionStorage.setItem(QUICK_RECORD_REQUEST_STORAGE_KEY, String(Date.now()));
}

export function consumeTrayQuickRecordRequest(): boolean {
  const value = sessionStorage.getItem(QUICK_RECORD_REQUEST_STORAGE_KEY);
  if (!value) return false;
  sessionStorage.removeItem(QUICK_RECORD_REQUEST_STORAGE_KEY);
  return true;
}
