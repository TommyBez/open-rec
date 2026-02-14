import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Annotation, Project } from "../../../types/project";

interface UseEditorProjectLoaderOptions {
  setProject: (project: Project) => void;
  setDuration: (duration: number) => void;
  setIsLoading: (loading: boolean) => void;
}

function normalizeProject(project: Project): Project {
  const overlay = project.edits.cameraOverlay;
  const audioMix = project.edits.audioMix;
  const colorCorrection = project.edits.colorCorrection;
  const annotations = project.edits.annotations;
  return {
    ...project,
    edits: {
      ...project.edits,
      cameraOverlay: {
        ...(overlay ?? {
          position: "bottom-right",
          margin: 20,
          scale: 0.25,
        }),
        customX: overlay?.customX ?? 1,
        customY: overlay?.customY ?? 1,
      },
      audioMix: {
        systemVolume: audioMix?.systemVolume ?? 1,
        microphoneVolume: audioMix?.microphoneVolume ?? 1,
        microphoneNoiseGate: audioMix?.microphoneNoiseGate ?? false,
      },
      colorCorrection: {
        brightness: colorCorrection?.brightness ?? 0,
        contrast: colorCorrection?.contrast ?? 1,
        saturation: colorCorrection?.saturation ?? 1,
      },
      annotations: (annotations ?? []).map((annotation) => ({
        ...annotation,
        mode: annotation.mode ?? "outline",
      })),
    },
  };
}

function buildFallbackProject(id: string): Project {
  const defaultDuration = 274.8;
  return {
    id,
    name: `Recording ${id.slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    screenVideoPath: "",
    duration: defaultDuration,
    resolution: { width: 1920, height: 1080 },
    edits: {
      segments: [
        {
          id: crypto.randomUUID(),
          startTime: 0,
          endTime: defaultDuration,
          enabled: true,
        },
      ],
      zoom: [],
      speed: [],
      annotations: [] as Annotation[],
      cameraOverlay: {
        position: "bottom-right",
        margin: 20,
        scale: 0.25,
        customX: 1,
        customY: 1,
      },
      audioMix: {
        systemVolume: 1,
        microphoneVolume: 1,
        microphoneNoiseGate: false,
      },
      colorCorrection: {
        brightness: 0,
        contrast: 1,
        saturation: 1,
      },
    },
  };
}

export function useEditorProjectLoader({
  setProject,
  setDuration,
  setIsLoading,
}: UseEditorProjectLoaderOptions) {
  const loadProject = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const result = await invoke<Project>("load_project", { projectId: id });
        const normalizedProject = normalizeProject(result);
        setProject(normalizedProject);
        setDuration(normalizedProject.duration);
      } catch (error) {
        console.error("Failed to load project:", error);
        const fallbackProject = buildFallbackProject(id);
        setProject(fallbackProject);
        setDuration(fallbackProject.duration);
      } finally {
        setIsLoading(false);
      }
    },
    [setDuration, setIsLoading, setProject]
  );

  return { loadProject };
}
