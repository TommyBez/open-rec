import { useRef, useEffect, useState } from "react";
import { writeFile, BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import { Camera, ChevronDown, VideoOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        "relative flex h-[100px] w-[140px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl",
        "border border-primary/30 bg-card/50 backdrop-blur-sm"
      )}>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <VideoOff className="size-5 text-primary/70" strokeWidth={1.5} />
        </div>
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          Camera access denied
        </span>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-[#0a0a0a] shadow-xl">
      {/* Video container with studio frame */}
      <div className="relative h-[100px] w-[140px] overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />
        
        {/* Vignette overlay for studio look */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]" />
        
        {/* Corner frame marks - broadcast style */}
        <div className="pointer-events-none absolute inset-2">
          <div className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-white/30" />
          <div className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-white/30" />
          <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-white/30" />
          <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-white/30" />
        </div>
        
        {/* Camera selector overlay */}
        {devices.length > 1 && (
          <div className="absolute inset-x-2 bottom-2 opacity-0 transition-all duration-200 group-hover:opacity-100">
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger 
                size="sm" 
                className="h-6 rounded-md border-0 bg-black/70 px-2 text-[10px] font-medium text-white/90 backdrop-blur-sm [&>svg]:hidden"
              >
                <SelectValue />
                <ChevronDown className="ml-auto size-3 text-white/50" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-0 bg-black/90 backdrop-blur-md">
                {devices.map((device, index) => (
                  <SelectItem 
                    key={device.deviceId} 
                    value={device.deviceId}
                    className="text-[11px] text-white/90 focus:bg-white/10 focus:text-white"
                  >
                    {device.label || `Camera ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-primary/90 px-2 py-1 shadow-lg">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <span className="text-[10px] font-bold tracking-wider text-white">
              REC
            </span>
          </div>
        )}
        
        {/* Live indicator when not recording */}
        {!isRecording && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 backdrop-blur-sm">
            <Camera className="size-3 text-white/70" strokeWidth={2} />
            <span className="text-[9px] font-medium uppercase tracking-wider text-white/70">
              Preview
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
