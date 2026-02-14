import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";

interface MicrophoneRecorderProps {
  enabled: boolean;
  isRecording: boolean;
  projectId: string | null;
  recordingStartTimeMs: number | null;
}

function getAudioMimeType(): string | undefined {
  const preferred = ["audio/webm;codecs=opus", "audio/webm"];
  return preferred.find((mime) => MediaRecorder.isTypeSupported(mime));
}

export function MicrophoneRecorder({
  enabled,
  isRecording,
  projectId,
  recordingStartTimeMs,
}: MicrophoneRecorderProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const activeProjectRef = useRef<string | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsStreamReady(false);
      return;
    }

    let disposed = false;

    async function initMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setIsStreamReady(true);
      } catch (error) {
        console.error("Failed to initialize microphone stream:", error);
        setIsStreamReady(false);
      }
    }

    initMicrophone();

    return () => {
      disposed = true;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsStreamReady(false);
    };
  }, [enabled]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!enabled || !isStreamReady || !stream || !projectId) {
      return;
    }

    if (isRecording && !recorderRef.current) {
      chunksRef.current = [];
      activeProjectRef.current = projectId;

      const mimeType = getAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (!activeProjectRef.current) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        try {
          await mkdir(`recordings/${activeProjectRef.current}`, {
            baseDir: BaseDirectory.AppData,
            recursive: true,
          }).catch(() => {});
          const arrayBuffer = await blob.arrayBuffer();
          await writeFile(
            `recordings/${activeProjectRef.current}/microphone.webm`,
            new Uint8Array(arrayBuffer),
            { baseDir: BaseDirectory.AppData }
          );
        } catch (error) {
          console.error("Failed to persist microphone track:", error);
        }
        chunksRef.current = [];
      };

      if (recordingStartTimeMs) {
        const offset = Date.now() - recordingStartTimeMs;
        void invoke("set_recording_media_offsets", {
          projectId,
          microphoneOffsetMs: offset,
        }).catch((error) => {
          console.error("Failed to persist microphone offset:", error);
        });
      }

      recorder.start(1000);
      recorderRef.current = recorder;
      return;
    }

    if (!isRecording && recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }, [enabled, isRecording, isStreamReady, projectId, recordingStartTimeMs]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
    };
  }, []);

  return null;
}
