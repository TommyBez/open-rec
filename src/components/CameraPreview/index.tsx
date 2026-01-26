import { useRef, useEffect, useState } from "react";
import { writeFile, BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import { Camera } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CameraPreviewProps {
  enabled: boolean;
  isRecording: boolean;
  projectId: string | null;
  onCameraReady?: (ready: boolean) => void;
  onRecordingComplete?: (blobUrl: string) => void;
}

export function CameraPreview({
  enabled,
  isRecording,
  projectId,
  onCameraReady,
  onRecordingComplete,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  // Get available camera devices
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permission first to get device labels
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
  }, [enabled]);

  // Start/stop camera stream
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
          audio: false, // Audio is captured separately
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        onCameraReady?.(true);
      } catch (error) {
        console.error("Failed to start camera:", error);
        setHasPermission(false);
        onCameraReady?.(false);
      }
    }

    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
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

  // Handle recording start/stop
  useEffect(() => {
    if (!enabled || !streamRef.current) return;

    if (isRecording && !mediaRecorderRef.current) {
      // Start recording
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const blobUrl = URL.createObjectURL(blob);
        onRecordingComplete?.(blobUrl);

        // Save to file if we have a project ID
        if (projectId) {
          try {
            // Ensure directory exists
            await mkdir(`recordings/${projectId}`, {
              baseDir: BaseDirectory.AppData,
              recursive: true,
            }).catch(() => {}); // Ignore if already exists
            
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            await writeFile(`recordings/${projectId}/camera.webm`, uint8Array, {
              baseDir: BaseDirectory.AppData,
            });
          } catch (error) {
            console.error("Failed to save camera recording:", error);
          }
        }

        chunksRef.current = [];
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
    } else if (!isRecording && mediaRecorderRef.current) {
      // Stop recording
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
  }, [isRecording, enabled, projectId, onRecordingComplete]);

  if (!enabled) {
    return null;
  }

  if (hasPermission === false) {
    return (
      <div className={cn(
        "relative flex h-[90px] w-[120px] flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2",
        "border-destructive bg-destructive/10"
      )}>
        <Camera className="text-muted-foreground size-5 opacity-50" />
        <span className="text-destructive text-center text-[10px]">
          Camera access denied
        </span>
      </div>
    );
  }

  return (
    <div className="group relative h-[90px] w-[120px] overflow-hidden rounded-md border-2 border-border bg-[#1a1a1a]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full -scale-x-100 object-cover"
      />
      {devices.length > 1 && (
        <div className="absolute inset-x-1 bottom-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger size="sm" className="h-6 border-0 bg-black/70 text-[9px] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device, index) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {isRecording && (
        <Badge
          variant="destructive"
          className="absolute top-1 right-1 gap-1 px-1.5 py-0.5 text-[9px]"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          REC
        </Badge>
      )}
    </div>
  );
}
