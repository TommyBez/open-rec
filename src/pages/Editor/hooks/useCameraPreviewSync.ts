import type { RefObject } from "react";
import { useEffect } from "react";

interface UseCameraPreviewSyncOptions {
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  cameraSrc?: string;
  showCamera: boolean;
  cameraTime: number;
  currentPlaybackRate: number;
  isPlaying: boolean;
}

export function useCameraPreviewSync({
  cameraVideoRef,
  cameraSrc,
  showCamera,
  cameraTime,
  currentPlaybackRate,
  isPlaying,
}: UseCameraPreviewSyncOptions) {
  useEffect(() => {
    const camera = cameraVideoRef.current;
    if (!camera || !cameraSrc || !showCamera) return;
    if (Math.abs(camera.currentTime - cameraTime) > 0.08) {
      camera.currentTime = Math.max(0, cameraTime);
    }
  }, [cameraSrc, cameraTime, showCamera, cameraVideoRef]);

  useEffect(() => {
    const camera = cameraVideoRef.current;
    if (!camera || !cameraSrc) return;
    camera.playbackRate = currentPlaybackRate;
    if (!showCamera) {
      camera.pause();
      return;
    }
    if (isPlaying) {
      camera.play().catch(() => undefined);
    } else {
      camera.pause();
    }
  }, [cameraSrc, isPlaying, currentPlaybackRate, showCamera, cameraVideoRef]);
}
