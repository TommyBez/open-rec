import { AppWindow, Monitor } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SourceSelector } from "../../../components/SourceSelector";
import { MicrophoneRecorder } from "../../../components/MicrophoneRecorder";
import { CameraPreview } from "../../../components/CameraPreview";
import { SourceTypeButton } from "../../../components/SourceTypeButton";
import { RecorderHeader } from "./RecorderHeader";
import { CountdownOverlay } from "./CountdownOverlay";
import { RecorderInputSources } from "./RecorderInputSources";
import { RecorderQualityControls } from "./RecorderQualityControls";
import { RecorderActionButtons } from "./RecorderActionButtons";
import { RecorderMainPanelProps } from "./recorderMainPanel.types";
export function RecorderMainPanel({
  selectedSource,
  countdown,
  errorMessage,
  finalizingMessage,
  diskWarning,
  sourceType,
  sources,
  isLoadingSources,
  captureCamera,
  isActivelyRecording,
  projectId,
  recordingStartTimeMs,
  captureMicrophone,
  captureSystemAudio,
  cameraReady,
  qualityPreset,
  codec,
  isRecording,
  onOpenVideos,
  onSetSourceType,
  onSetSelectedSource,
  onSetCameraReady,
  onToggleCamera,
  onToggleMicrophone,
  onToggleSystemAudio,
  onQualityPresetChange,
  onCodecChange,
  showOpenRecordingWidgetButton,
  onOpenRecordingWidget,
  onStartRecording,
}: RecorderMainPanelProps) {
  const sourceControlsLocked = isRecording || countdown !== null;

  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          selectedSource
            ? "bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.08_25)_0%,transparent_60%)] opacity-50"
            : "bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40"
        )}
      />
      <RecorderHeader ready={!!selectedSource} onOpenVideos={onOpenVideos} />
      <main className="relative z-10 flex flex-1 flex-col gap-4">
        {countdown !== null && <CountdownOverlay value={countdown} />}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </div>
        )}
        {finalizingMessage && (
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
            {finalizingMessage}
          </div>
        )}
        {diskWarning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            {diskWarning}
          </div>
        )}
        <div className="studio-panel animate-fade-up-delay-1 rounded-xl p-1">
          <div className="flex gap-1">
            <SourceTypeButton active={sourceType === "display"} onClick={() => onSetSourceType("display")} icon={<Monitor className="size-4" />} label="Screen" disabled={sourceControlsLocked} />
            <SourceTypeButton active={sourceType === "window"} onClick={() => onSetSourceType("window")} icon={<AppWindow className="size-4" />} label="Window" disabled={sourceControlsLocked} />
          </div>
        </div>
        <div className="animate-fade-up-delay-2">
          <SourceSelector sources={sources} selectedSource={selectedSource} onSelect={onSetSelectedSource} isLoading={isLoadingSources} disabled={sourceControlsLocked} />
        </div>
        <AnimatePresence>
          {captureCamera && (
            <motion.div
              className="my-1 flex justify-center"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <CameraPreview
                enabled={captureCamera}
                isRecording={isActivelyRecording}
                projectId={projectId}
                recordingStartTimeMs={recordingStartTimeMs}
                onCameraReady={onSetCameraReady}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <MicrophoneRecorder
          enabled={captureMicrophone}
          isRecording={isActivelyRecording}
          projectId={projectId}
          recordingStartTimeMs={recordingStartTimeMs}
        />
        <RecorderInputSources
          captureCamera={captureCamera}
          cameraReady={cameraReady}
          captureMicrophone={captureMicrophone}
          captureSystemAudio={captureSystemAudio}
          onToggleCamera={onToggleCamera}
          onToggleMicrophone={onToggleMicrophone}
          onToggleSystemAudio={onToggleSystemAudio}
        />
        <RecorderQualityControls
          qualityPreset={qualityPreset}
          codec={codec}
          onQualityPresetChange={onQualityPresetChange}
          onCodecChange={onCodecChange}
        />
        <div className="flex-1" />
        <RecorderActionButtons
          canStartRecording={Boolean(selectedSource)}
          isRecording={isRecording}
          showOpenRecordingWidgetButton={showOpenRecordingWidgetButton}
          onOpenRecordingWidget={onOpenRecordingWidget}
          onStartRecording={onStartRecording}
        />
      </main>
    </div>
  );
}
