import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";

function getVideoMimeType(): string | undefined {
  const preferred = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return preferred.find((mime) => MediaRecorder.isTypeSupported(mime));
}

interface UseCameraCaptureOptions {
  enabled: boolean;
  isRecording: boolean;
  projectId: string | null;
  recordingStartTimeMs: number | null;
  onCameraReady?: (ready: boolean) => void;
  onRecordingComplete?: (blobUrl: string) => void;
}

export function useCameraCapture({
  enabled,
  isRecording,
  projectId,
  recordingStartTimeMs,
  onCameraReady,
  onRecordingComplete,
}: UseCameraCaptureOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  useEffect(() => {
    async function getDevices() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((track) => track.stop());
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(videoDevices[0].deviceId);
        }
        setHasPermission(true);
      } catch (error) {
        console.error("Failed to get camera devices:", error);
        setHasPermission(false);
      }
    }

    if (enabled) {
      getDevices();
    }
  }, [enabled, selectedDevice]);

  useEffect(() => {
    async function startCamera() {
      if (!enabled || !selectedDevice) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDevice,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsStreamReady(true);
        onCameraReady?.(true);
      } catch (error) {
        console.error("Failed to start camera:", error);
        setHasPermission(false);
        setIsStreamReady(false);
        onCameraReady?.(false);
      }
    }

    function stopCamera() {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsStreamReady(false);
      onCameraReady?.(false);
    }

    if (enabled && selectedDevice) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [enabled, selectedDevice, onCameraReady]);

  useEffect(() => {
    if (!enabled || !isStreamReady || !streamRef.current || !projectId) return;

    if (isRecording && !mediaRecorderRef.current) {
      chunksRef.current = [];
      const mimeType = getVideoMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(streamRef.current, {
            mimeType,
            videoBitsPerSecond: 2500000,
          })
        : new MediaRecorder(streamRef.current);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const blobUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = blobUrl;
        onRecordingComplete?.(blobUrl);

        try {
          await mkdir(`recordings/${projectId}`, {
            baseDir: BaseDirectory.AppData,
            recursive: true,
          }).catch(() => {});

          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await writeFile(`recordings/${projectId}/camera.webm`, uint8Array, {
            baseDir: BaseDirectory.AppData,
          });
        } catch (error) {
          console.error("Failed to save camera recording:", error);
        }

        chunksRef.current = [];
      };

      if (recordingStartTimeMs) {
        const offset = Date.now() - recordingStartTimeMs;
        void invoke("set_recording_media_offsets", {
          projectId,
          cameraOffsetMs: offset,
        }).catch((error) => {
          console.error("Failed to persist camera offset:", error);
        });
      }

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
    } else if (!isRecording && mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    };
  }, [isRecording, enabled, isStreamReady, projectId, recordingStartTimeMs, onRecordingComplete]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    hasPermission,
    devices,
    selectedDevice,
    setSelectedDevice,
  };
}
