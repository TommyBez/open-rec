const MISSING_RETRY_CONTEXT_PHRASE = "No failed finalization context is available for retry";

export function isMissingFinalizationRetryContextMessage(
  message: string | null | undefined
): boolean {
  if (!message) {
    return false;
  }
  return message.includes(MISSING_RETRY_CONTEXT_PHRASE);
}
