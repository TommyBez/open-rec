import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Circle, Maximize2 } from "lucide-react";
import { SourceSelector } from "../../components/SourceSelector";
import { ToggleRow } from "../../components/ToggleRow";
import { Button } from "@/components/ui/button";
import { CameraPreview } from "../../components/CameraPreview";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CaptureSource {
  id: string;
  name: string;
  type: "display" | "window";
  thumbnail?: string;
}

export interface RecordingOptions {
  sourceId: string;
  sourceType: "display" | "window";
  captureCamera: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
}

export function RecorderPage() {
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState<"display" | "window">("display");
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);
  const [captureCamera, setCaptureCamera] = useState(false);
  const [captureMicrophone, setCaptureMicrophone] = useState(false);
  const [captureSystemAudio, setCaptureSystemAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, []);

  // Load capture sources when permission is granted and source type changes
  useEffect(() => {
    if (hasPermission) {
      loadSources();
    }
  }, [sourceType, hasPermission]);

  async function checkPermission() {
    try {
      const granted = await invoke<boolean>("check_permission");
      setHasPermission(granted);
    } catch (error) {
      console.error("Failed to check permission:", error);
      setHasPermission(false);
    }
  }

  async function requestPermission() {
    try {
      const granted = await invoke<boolean>("request_permission");
      setHasPermission(granted);
      if (granted) {
        loadSources();
      }
    } catch (error) {
      console.error("Failed to request permission:", error);
    }
  }

  // Listen for recording stopped event to navigate to editor
  useEffect(() => {
    const unlisten = listen<string>("recording-stopped", (event) => {
      setIsRecording(false);
      // Navigate to editor with the project ID
      navigate(`/editor/${event.payload}`);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate]);

  async function loadSources() {
    setIsLoading(true);
    try {
      const result = await invoke<CaptureSource[]>("list_capture_sources", {
        sourceType,
      });
      setSources(result);
      if (result.length > 0 && !selectedSource) {
        setSelectedSource(result[0]);
      }
    } catch (error) {
      console.error("Failed to load capture sources:", error);
      // For development, use mock data
      const mockSources: CaptureSource[] = sourceType === "display" 
        ? [{ id: "main", name: "Built-in Display", type: "display" }]
        : [
            { id: "1", name: "Cursor", type: "window" },
            { id: "2", name: "Safari", type: "window" },
            { id: "3", name: "Finder", type: "window" },
          ];
      setSources(mockSources);
      if (mockSources.length > 0) {
        setSelectedSource(mockSources[0]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function startRecording() {
    if (!selectedSource) return;
    
    setIsRecording(true);
    try {
      const options: RecordingOptions = {
        sourceId: selectedSource.id,
        sourceType: selectedSource.type,
        captureCamera,
        captureMicrophone,
        captureSystemAudio,
      };
      
      const result = await invoke<{ projectId: string }>("start_screen_recording", { options });
      
      // Store project ID for camera recording and in localStorage for widget
      setCurrentProjectId(result.projectId);
      localStorage.setItem("currentProjectId", result.projectId);
      
      // Open the recording widget window
      await invoke("open_recording_widget");
      
      // Hide the main window while recording
      const mainWindow = getCurrentWindow();
      await mainWindow.hide();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
    }
  }

  // Show permission request UI if permission not granted
  if (hasPermission === false) {
    return (
      <div className="bg-background flex h-full flex-col p-4">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-full border-3 border-secondary bg-gradient-to-br from-blue-400 to-blue-500 shadow-md" />
            <span className="text-foreground text-lg font-semibold">Open Rec</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="mb-2 text-5xl">🔒</div>
          <h2 className="text-foreground text-lg font-semibold">Screen Recording Permission Required</h2>
          <p className="text-muted-foreground text-sm">Open Rec needs permission to record your screen.</p>
          <Button size="lg" onClick={requestPermission}>
            Grant Permission
          </Button>
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            If the system dialog doesn't appear, go to<br />
            <strong className="text-foreground">System Settings → Privacy & Security → Screen Recording</strong><br />
            and enable Open Rec.
          </p>
        </main>
      </div>
    );
  }

  // Show loading state while checking permission
  if (hasPermission === null) {
    return (
      <div className="bg-background flex h-full flex-col p-4">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-full border-3 border-secondary bg-gradient-to-br from-blue-400 to-blue-500 shadow-md" />
            <span className="text-foreground text-lg font-semibold">Open Rec</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-3">
          <p className="text-muted-foreground">Checking permissions...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col p-4">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-full border-3 border-secondary bg-gradient-to-br from-blue-400 to-blue-500 shadow-md" />
          <span className="text-foreground text-lg font-semibold">Open Rec</span>
        </div>
      </header>

      <main className="flex flex-col gap-3">
        {/* Source Type Selector */}
        <div className="bg-card flex items-center gap-3 rounded-lg border border-border p-2.5 px-3.5">
          <Maximize2 className="text-muted-foreground size-5 opacity-60" />
          <SourceSelector
            sources={sources}
            selectedSource={selectedSource}
            onSelect={setSelectedSource}
            isLoading={isLoading}
          />
          <Tabs
            value={sourceType}
            onValueChange={(value) => setSourceType(value as "display" | "window")}
          >
            <TabsList>
              <TabsTrigger value="display">Screen</TabsTrigger>
              <TabsTrigger value="window">Window</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Camera Preview */}
        {captureCamera && (
          <div className="my-2 flex justify-center">
            <CameraPreview
              enabled={captureCamera}
              isRecording={isRecording}
              projectId={currentProjectId}
              onCameraReady={setCameraReady}
            />
          </div>
        )}

        {/* Toggle Options */}
        <div className="flex flex-col gap-2">
          <ToggleRow
            icon="camera"
            label={captureCamera ? (cameraReady ? "Camera" : "Camera (loading...)") : "No Camera"}
            enabled={captureCamera}
            onToggle={() => setCaptureCamera(!captureCamera)}
          />
          <ToggleRow
            icon="microphone"
            label={captureMicrophone ? "Microphone" : "No Microphone"}
            enabled={captureMicrophone}
            onToggle={() => setCaptureMicrophone(!captureMicrophone)}
          />
          <ToggleRow
            icon="speaker"
            label={captureSystemAudio ? "System Audio" : "No System Audio"}
            enabled={captureSystemAudio}
            onToggle={() => setCaptureSystemAudio(!captureSystemAudio)}
          />
        </div>

        {/* Start Recording Button */}
        <Button
          size="lg"
          onClick={startRecording}
          disabled={!selectedSource || isRecording}
          className="mt-2 w-full gap-2"
        >
          <Circle className="size-4 fill-current" />
          Start Recording
        </Button>
      </main>
    </div>
  );
}
