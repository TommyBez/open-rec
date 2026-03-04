import { useCallback, useEffect, useRef, useState } from "react";

export function useRecordingCountdown() {
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const onCompleteRef = useRef<(() => Promise<void>) | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((onComplete: () => Promise<void>) => {
    if (countdown !== null) return;
    onCompleteRef.current = onComplete;
    setCountdown(3);
    let value = 3;
    countdownIntervalRef.current = window.setInterval(() => {
      value -= 1;
      if (value <= 0) {
        clearCountdown();
        setCountdown(null);
        void onCompleteRef.current?.();
        onCompleteRef.current = null;
      } else {
        setCountdown(value);
      }
    }, 1000);
  }, [clearCountdown, countdown]);

  const cancelCountdown = useCallback(() => {
    clearCountdown();
    setCountdown(null);
    onCompleteRef.current = null;
  }, [clearCountdown]);

  useEffect(() => {
    return () => clearCountdown();
  }, [clearCountdown]);

  useEffect(() => {
    if (countdown === null) return;
    function handleCancelCountdown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      cancelCountdown();
    }
    window.addEventListener("keydown", handleCancelCountdown);
    return () => window.removeEventListener("keydown", handleCancelCountdown);
  }, [cancelCountdown, countdown]);

  return {
    countdown,
    startCountdown,
    cancelCountdown,
  };
}
