import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Monitor, AppWindow, Lock } from "lucide-react";
import { SourceSelector } from "../../components/SourceSelector";
import { ToggleRow } from "../../components/ToggleRow";
import { Button } from "@/components/ui/button";
import { CameraPreview } from "../../components/CameraPreview";
import { cn } from "@/lib/utils";

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
      <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
        {/* Atmospheric background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_25)_0%,transparent_50%)] opacity-40" />
        
        <header className="relative z-10 mb-6 animate-fade-up">
          <BrandLogo />
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="animate-fade-up-delay-1 flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
            <Lock className="size-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="animate-fade-up-delay-2 space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Permission Required
            </h2>
            <p className="text-sm text-muted-foreground">
              Open Rec needs access to record your screen.
            </p>
          </div>
          <Button 
            size="lg" 
            onClick={requestPermission}
            className="animate-fade-up-delay-3 mt-2 gap-2 bg-primary px-8 font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/25"
          >
            Grant Permission
          </Button>
          <p className="animate-fade-up-delay-4 mt-4 max-w-[280px] text-xs leading-relaxed text-muted-foreground/70">
            If the system dialog doesn't appear, go to{" "}
            <span className="font-medium text-foreground/80">
              System Settings → Privacy & Security → Screen Recording
            </span>
          </p>
        </main>
      </div>
    );
  }

  // Show loading state while checking permission
  if (hasPermission === null) {
    return (
      <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_25)_0%,transparent_50%)] opacity-40" />
        <header className="relative z-10 mb-6 animate-fade-up">
          <BrandLogo />
        </header>
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Checking permissions...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
      {/* Atmospheric background - subtle red glow at top when ready to record */}
      <div 
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          selectedSource 
            ? "bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.08_25)_0%,transparent_60%)] opacity-50"
            : "bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40"
        )}
      />
      
      {/* Header */}
      <header className="relative z-10 mb-6 flex items-center justify-between animate-fade-up">
        <BrandLogo />
        <StatusIndicator ready={!!selectedSource} />
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-4">
        {/* Source Selector Panel */}
        <div className="studio-panel animate-fade-up-delay-1 rounded-xl p-1">
          <div className="flex gap-1">
            <SourceTypeButton
              active={sourceType === "display"}
              onClick={() => setSourceType("display")}
              icon={<Monitor className="size-4" />}
              label="Screen"
            />
            <SourceTypeButton
              active={sourceType === "window"}
              onClick={() => setSourceType("window")}
              icon={<AppWindow className="size-4" />}
              label="Window"
            />
          </div>
        </div>

        {/* Source Dropdown */}
        <div className="animate-fade-up-delay-2">
          <SourceSelector
            sources={sources}
            selectedSource={selectedSource}
            onSelect={setSelectedSource}
            isLoading={isLoading}
          />
        </div>

        {/* Camera Preview */}
        {captureCamera && (
          <div className="my-1 flex justify-center animate-scale-in">
            <CameraPreview
              enabled={captureCamera}
              isRecording={isRecording}
              projectId={currentProjectId}
              onCameraReady={setCameraReady}
            />
          </div>
        )}

        {/* Input Sources */}
        <div className="animate-fade-up-delay-3 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
            Input Sources
          </span>
          <div className="flex flex-col gap-1.5">
            <ToggleRow
              icon="camera"
              label="Camera"
              sublabel={captureCamera ? (cameraReady ? "Ready" : "Loading...") : "Off"}
              enabled={captureCamera}
              onToggle={() => setCaptureCamera(!captureCamera)}
            />
            <ToggleRow
              icon="microphone"
              label="Microphone"
              sublabel={captureMicrophone ? "Ready" : "Off"}
              enabled={captureMicrophone}
              onToggle={() => setCaptureMicrophone(!captureMicrophone)}
            />
            <ToggleRow
              icon="speaker"
              label="System Audio"
              sublabel={captureSystemAudio ? "Ready" : "Off"}
              enabled={captureSystemAudio}
              onToggle={() => setCaptureSystemAudio(!captureSystemAudio)}
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Record Button */}
        <div className="animate-fade-up-delay-4">
          <RecordButton
            onClick={startRecording}
            disabled={!selectedSource || isRecording}
          />
        </div>
      </main>
    </div>
  );
}

/* ============================================
   Sub-components for the Studio Aesthetic
   ============================================ */

function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Custom logo mark - stylized "rec" indicator */}
      <div className="relative flex size-10 items-center justify-center">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5" />
        <div className="relative size-4 rounded-full bg-primary shadow-lg" style={{ boxShadow: '0 0 12px oklch(0.62 0.24 25 / 0.5)' }} />
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-semibold tracking-tight text-foreground">
          Open Rec
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
          Studio
        </span>
      </div>
    </div>
  );
}

function StatusIndicator({ ready }: { ready: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
      ready 
        ? "bg-primary/10 text-primary" 
        : "bg-muted/50 text-muted-foreground"
    )}>
      <div className={cn(
        "size-2 rounded-full transition-all duration-300",
        ready 
          ? "bg-primary animate-pulse shadow-[0_0_8px_oklch(0.62_0.24_25_/_0.6)]" 
          : "bg-muted-foreground/50"
      )} />
      {ready ? "Ready" : "Select Source"}
    </div>
  );
}

function SourceTypeButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-card text-foreground shadow-md"
          : "text-muted-foreground hover:text-foreground/80"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RecordButton({ 
  onClick, 
  disabled 
}: { 
  onClick: () => void; 
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center justify-center gap-3 rounded-xl px-6 py-4 font-semibold transition-all duration-200",
        disabled
          ? "cursor-not-allowed bg-muted text-muted-foreground opacity-50"
          : "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-[0.98]"
      )}
    >
      {/* Record indicator dot */}
      <div className={cn(
        "size-2.5 rounded-full transition-colors",
        disabled ? "bg-muted-foreground/50" : "bg-white"
      )} />
      <span className="text-sm tracking-tight">Start Recording</span>
    </button>
  );
}
