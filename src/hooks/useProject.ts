import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Annotation, AudioMixSettings, CameraOverlaySettings, ColorCorrectionSettings, Project, Segment, ZoomEffect, SpeedEffect } from "../types/project";

const MAX_HISTORY_SIZE = 50;

export function useProject(initialProject: Project | null) {
  const [project, setProjectState] = useState<Project | null>(initialProject);
  const [isDirty, setIsDirty] = useState(false);
  
  // History for undo functionality
  const historyRef = useRef<Project[]>([]);
  const futureRef = useRef<Project[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Generate a unique ID for new effects
  const generateId = () => crypto.randomUUID();

  // Push current state to history before making changes
  const pushToHistory = useCallback((currentProject: Project) => {
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY_SIZE - 1)),
      currentProject,
    ];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Undo: restore previous state
  const undo = useCallback(() => {
    setProjectState((currentState) => {
      if (!currentState || historyRef.current.length === 0) return currentState;
      const previousState = historyRef.current.pop();
      if (!previousState) return currentState;
      futureRef.current = [
        ...futureRef.current.slice(-(MAX_HISTORY_SIZE - 1)),
        currentState,
      ];
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(futureRef.current.length > 0);
      setIsDirty(true);
      return previousState;
    });
  }, []);

  // Redo: restore the latest undone state
  const redo = useCallback(() => {
    setProjectState((currentState) => {
      if (!currentState || futureRef.current.length === 0) return currentState;
      const nextState = futureRef.current.pop();
      if (!nextState) return currentState;
      historyRef.current = [
        ...historyRef.current.slice(-(MAX_HISTORY_SIZE - 1)),
        currentState,
      ];
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(futureRef.current.length > 0);
      setIsDirty(true);
      return nextState;
    });
  }, []);

  // Update project and mark as dirty
  const updateProject = useCallback((updater: (p: Project) => Project) => {
    setProjectState((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      if (updated === prev) {
        return prev;
      }
      // Save current state to history before updating
      pushToHistory(prev);
      setIsDirty(true);
      return updated;
    });
  }, [pushToHistory]);

  const patchProject = useCallback((updater: (p: Project) => Project) => {
    setProjectState((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      if (updated === prev) {
        return prev;
      }
      setIsDirty(true);
      return updated;
    });
  }, []);

  const replaceProject = useCallback((nextProject: Project) => {
    historyRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setIsDirty(false);
    setProjectState(nextProject);
  }, []);

  // Save project to backend
  const saveProject = useCallback(async () => {
    if (!project) return;
    try {
      await invoke("save_project", { project });
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save project:", error);
      throw error;
    }
  }, [project]);

  // Rename project
  const renameProject = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateProject((p) =>
      p.name === trimmed
        ? p
        : {
            ...p,
            name: trimmed,
          }
    );
  }, [updateProject]);

  // Cut: Split a segment at the given time
  const cutAt = useCallback((time: number) => {
    updateProject((p) => {
      const newSegments: Segment[] = [];
      
      for (const segment of p.edits.segments) {
        if (time > segment.startTime && time < segment.endTime && segment.enabled) {
          // Split this segment
          newSegments.push({
            ...segment,
            endTime: time,
          });
          newSegments.push({
            id: generateId(),
            startTime: time,
            endTime: segment.endTime,
            enabled: true,
          });
        } else {
          newSegments.push(segment);
        }
      }
      
      return {
        ...p,
        edits: { ...p.edits, segments: newSegments },
      };
    });
  }, [updateProject]);

  // Toggle segment enabled/disabled (remove from final output)
  const toggleSegment = useCallback((segmentId: string) => {
    updateProject((p) => {
      const hasSegment = p.edits.segments.some((segment) => segment.id === segmentId);
      if (!hasSegment) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          segments: p.edits.segments.map((segment) =>
            segment.id === segmentId ? { ...segment, enabled: !segment.enabled } : segment
          ),
        },
      };
    });
  }, [updateProject]);

  // Delete a segment (keeps source video time references intact)
  const deleteSegment = useCallback((segmentId: string) => {
    updateProject((p) => {
      const nextSegments = p.edits.segments.filter((segment) => segment.id !== segmentId);
      if (nextSegments.length === p.edits.segments.length) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          segments: nextSegments,
        },
      };
    });
  }, [updateProject]);

  // Add a zoom effect (automatically adjusts end time to avoid overlapping existing zooms)
  const addZoom = useCallback((startTime: number, endTime: number, scale: number = 1.5) => {
    updateProject((p) => {
      // Find the earliest zoom segment that starts after our start time
      // to prevent overlap
      let adjustedEndTime = endTime;
      const minDuration = 0.5; // Minimum zoom duration
      
      for (const existingZoom of p.edits.zoom) {
        // If this zoom starts after our start and before our end, we'd overlap
        if (existingZoom.startTime > startTime && existingZoom.startTime < adjustedEndTime) {
          adjustedEndTime = existingZoom.startTime;
        }
        // If our start is inside an existing zoom, don't create (return unchanged)
        if (startTime >= existingZoom.startTime && startTime < existingZoom.endTime) {
          return p; // Start is inside existing zoom, abort
        }
      }
      
      // Ensure minimum duration
      if (adjustedEndTime - startTime < minDuration) {
        return p; // Not enough room, abort
      }
      
      return {
        ...p,
        edits: {
          ...p.edits,
          zoom: [
            ...p.edits.zoom,
            {
              id: generateId(),
              startTime,
              endTime: adjustedEndTime,
              scale,
              x: 0,
              y: 0,
            },
          ],
        },
      };
    });
  }, [updateProject]);

  // Update a zoom effect (prevents overlapping with other zooms)
  const updateZoom = useCallback((zoomId: string, updates: Partial<ZoomEffect>) => {
    updateProject((p) => {
      const currentZoom = p.edits.zoom.find(z => z.id === zoomId);
      if (!currentZoom) return p;
      
      let newStartTime = updates.startTime ?? currentZoom.startTime;
      let newEndTime = updates.endTime ?? currentZoom.endTime;
      const minDuration = 0.5;
      
      // Detect if this is a "move" operation (both edges updated together)
      const isMove = updates.startTime !== undefined && updates.endTime !== undefined;
      
      // Check against all other zoom segments for overlaps
      for (const otherZoom of p.edits.zoom) {
        if (otherZoom.id === zoomId) continue;
        
        if (isMove) {
          // For a move operation, abort if any overlap would occur instead of clamping
          // This preserves the original duration
          
          // Would encompass another zoom entirely - abort
          if (newStartTime < otherZoom.startTime && newEndTime > otherZoom.endTime) {
            return p;
          }
          
          // Start would go into another zoom - abort
          if (newStartTime >= otherZoom.startTime && newStartTime < otherZoom.endTime) {
            return p;
          }
          
          // End would go into another zoom - abort
          if (newEndTime > otherZoom.startTime && newEndTime <= otherZoom.endTime) {
            return p;
          }
        } else {
          // Single-edge move: use clamping behavior
          
          // Prevent start from going into another zoom
          if (newStartTime >= otherZoom.startTime && newStartTime < otherZoom.endTime) {
            newStartTime = otherZoom.endTime;
          }
          
          // Prevent end from going into another zoom
          if (newEndTime > otherZoom.startTime && newEndTime <= otherZoom.endTime) {
            newEndTime = otherZoom.startTime;
          }
          
          // Prevent encompassing another zoom entirely
          if (newStartTime < otherZoom.startTime && newEndTime > otherZoom.endTime) {
            // Decide based on which side we're moving
            if (updates.startTime !== undefined && updates.endTime === undefined) {
              // Moving start, clamp to not pass the other zoom's end
              newStartTime = Math.max(newStartTime, otherZoom.endTime);
            } else if (updates.endTime !== undefined && updates.startTime === undefined) {
              // Moving end, clamp to not pass the other zoom's start
              newEndTime = Math.min(newEndTime, otherZoom.startTime);
            }
          }
        }
      }
      
      // Ensure minimum duration
      if (newEndTime - newStartTime < minDuration) {
        return p; // Would result in too small segment, abort
      }
      
      return {
        ...p,
        edits: {
          ...p.edits,
          zoom: p.edits.zoom.map((z) =>
            z.id === zoomId ? { ...z, ...updates, startTime: newStartTime, endTime: newEndTime } : z
          ),
        },
      };
    });
  }, [updateProject]);

  // Delete a zoom effect
  const deleteZoom = useCallback((zoomId: string) => {
    updateProject((p) => {
      const nextZoom = p.edits.zoom.filter((zoom) => zoom.id !== zoomId);
      if (nextZoom.length === p.edits.zoom.length) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          zoom: nextZoom,
        },
      };
    });
  }, [updateProject]);

  // Add a speed effect (automatically adjusts end time to avoid overlapping existing speeds)
  const addSpeed = useCallback((startTime: number, endTime: number, speed: number = 2.0) => {
    updateProject((p) => {
      // Find the earliest speed segment that starts after our start time
      // to prevent overlap
      let adjustedEndTime = endTime;
      const minDuration = 0.5; // Minimum speed duration
      
      for (const existingSpeed of p.edits.speed) {
        // If this speed starts after our start and before our end, we'd overlap
        if (existingSpeed.startTime > startTime && existingSpeed.startTime < adjustedEndTime) {
          adjustedEndTime = existingSpeed.startTime;
        }
        // If our start is inside an existing speed, don't create (return unchanged)
        if (startTime >= existingSpeed.startTime && startTime < existingSpeed.endTime) {
          return p; // Start is inside existing speed, abort
        }
      }
      
      // Ensure minimum duration
      if (adjustedEndTime - startTime < minDuration) {
        return p; // Not enough room, abort
      }
      
      return {
        ...p,
        edits: {
          ...p.edits,
          speed: [
            ...p.edits.speed,
            {
              id: generateId(),
              startTime,
              endTime: adjustedEndTime,
              speed,
            },
          ],
        },
      };
    });
  }, [updateProject]);

  // Update a speed effect (prevents overlapping with other speeds)
  const updateSpeed = useCallback((speedId: string, updates: Partial<SpeedEffect>) => {
    updateProject((p) => {
      const currentSpeed = p.edits.speed.find(s => s.id === speedId);
      if (!currentSpeed) return p;
      
      let newStartTime = updates.startTime ?? currentSpeed.startTime;
      let newEndTime = updates.endTime ?? currentSpeed.endTime;
      const minDuration = 0.5;
      
      // Detect if this is a "move" operation (both edges updated together)
      const isMove = updates.startTime !== undefined && updates.endTime !== undefined;
      
      // Check against all other speed segments for overlaps
      for (const otherSpeed of p.edits.speed) {
        if (otherSpeed.id === speedId) continue;
        
        if (isMove) {
          // For a move operation, abort if any overlap would occur instead of clamping
          // This preserves the original duration
          
          // Would encompass another speed entirely - abort
          if (newStartTime < otherSpeed.startTime && newEndTime > otherSpeed.endTime) {
            return p;
          }
          
          // Start would go into another speed - abort
          if (newStartTime >= otherSpeed.startTime && newStartTime < otherSpeed.endTime) {
            return p;
          }
          
          // End would go into another speed - abort
          if (newEndTime > otherSpeed.startTime && newEndTime <= otherSpeed.endTime) {
            return p;
          }
        } else {
          // Single-edge move: use clamping behavior
          
          // Prevent start from going into another speed
          if (newStartTime >= otherSpeed.startTime && newStartTime < otherSpeed.endTime) {
            newStartTime = otherSpeed.endTime;
          }
          
          // Prevent end from going into another speed
          if (newEndTime > otherSpeed.startTime && newEndTime <= otherSpeed.endTime) {
            newEndTime = otherSpeed.startTime;
          }
          
          // Prevent encompassing another speed entirely
          if (newStartTime < otherSpeed.startTime && newEndTime > otherSpeed.endTime) {
            // Decide based on which side we're moving
            if (updates.startTime !== undefined && updates.endTime === undefined) {
              // Moving start, clamp to not pass the other speed's end
              newStartTime = Math.max(newStartTime, otherSpeed.endTime);
            } else if (updates.endTime !== undefined && updates.startTime === undefined) {
              // Moving end, clamp to not pass the other speed's start
              newEndTime = Math.min(newEndTime, otherSpeed.startTime);
            }
          }
        }
      }
      
      // Ensure minimum duration
      if (newEndTime - newStartTime < minDuration) {
        return p; // Would result in too small segment, abort
      }
      
      return {
        ...p,
        edits: {
          ...p.edits,
          speed: p.edits.speed.map((s) =>
            s.id === speedId ? { ...s, ...updates, startTime: newStartTime, endTime: newEndTime } : s
          ),
        },
      };
    });
  }, [updateProject]);

  // Delete a speed effect
  const deleteSpeed = useCallback((speedId: string) => {
    updateProject((p) => {
      const nextSpeed = p.edits.speed.filter((speedSegment) => speedSegment.id !== speedId);
      if (nextSpeed.length === p.edits.speed.length) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          speed: nextSpeed,
        },
      };
    });
  }, [updateProject]);

  // Set whole video speed
  const setGlobalSpeed = useCallback((speed: number) => {
    if (!project) return;
    
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        speed: [
          {
            id: generateId(),
            startTime: 0,
            endTime: p.duration,
            speed,
          },
        ],
      },
    }));
  }, [project, updateProject]);

  const addAnnotation = useCallback((
    startTime: number,
    endTime: number,
    mode: "outline" | "blur" | "text" | "arrow" = "outline"
  ) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        annotations: [
          ...p.edits.annotations,
          {
            id: generateId(),
            startTime,
            endTime,
            x: 0.12,
            y: 0.12,
            width: 0.3,
            height: 0.2,
            color: "#facc15",
            opacity: 0.95,
            thickness: 4,
            text: "",
            mode,
          },
        ],
      },
    }));
  }, [updateProject]);

  const deleteAnnotation = useCallback((annotationId: string) => {
    updateProject((p) => {
      const nextAnnotations = p.edits.annotations.filter((annotation) => annotation.id !== annotationId);
      if (nextAnnotations.length === p.edits.annotations.length) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          annotations: nextAnnotations,
        },
      };
    });
  }, [updateProject]);

  const updateAnnotation = useCallback((annotationId: string, updates: Partial<Annotation>) => {
    updateProject((p) => {
      const targetAnnotation = p.edits.annotations.find((annotation) => annotation.id === annotationId);
      if (!targetAnnotation) return p;
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => targetAnnotation[key as keyof Annotation] !== value
      );
      if (!hasChanges) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          annotations: p.edits.annotations.map((annotation) =>
            annotation.id === annotationId ? { ...annotation, ...updates } : annotation
          ),
        },
      };
    });
  }, [updateProject]);

  const duplicateAnnotation = useCallback((annotationId: string) => {
    updateProject((p) => {
      const source = p.edits.annotations.find((annotation) => annotation.id === annotationId);
      if (!source) return p;

      const shift = 0.2;
      const duration = Math.max(0.1, source.endTime - source.startTime);
      const startTime = Math.min(Math.max(0, source.startTime + shift), Math.max(0, p.duration - duration));
      const endTime = Math.min(p.duration, startTime + duration);

      return {
        ...p,
        edits: {
          ...p.edits,
          annotations: [
            ...p.edits.annotations,
            {
              ...source,
              id: generateId(),
              startTime,
              endTime,
            },
          ],
        },
      };
    });
  }, [updateProject]);

  const updateCameraOverlay = useCallback((updates: Partial<CameraOverlaySettings>) => {
    updateProject((p) => {
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => p.edits.cameraOverlay[key as keyof CameraOverlaySettings] !== value
      );
      if (!hasChanges) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          cameraOverlay: {
            ...p.edits.cameraOverlay,
            ...updates,
          },
        },
      };
    });
  }, [updateProject]);

  const updateAudioMix = useCallback((updates: Partial<AudioMixSettings>) => {
    updateProject((p) => {
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => p.edits.audioMix[key as keyof AudioMixSettings] !== value
      );
      if (!hasChanges) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          audioMix: {
            ...p.edits.audioMix,
            ...updates,
          },
        },
      };
    });
  }, [updateProject]);

  const updateColorCorrection = useCallback((updates: Partial<ColorCorrectionSettings>) => {
    updateProject((p) => {
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => p.edits.colorCorrection[key as keyof ColorCorrectionSettings] !== value
      );
      if (!hasChanges) return p;
      return {
        ...p,
        edits: {
          ...p.edits,
          colorCorrection: {
            ...p.edits.colorCorrection,
            ...updates,
          },
        },
      };
    });
  }, [updateProject]);

  return {
    project,
    setProject: setProjectState,
    replaceProject,
    patchProject,
    isDirty,
    saveProject,
    renameProject,
    // History
    canUndo,
    canRedo,
    undo,
    redo,
    // Cutting
    cutAt,
    toggleSegment,
    deleteSegment,
    // Zoom
    addZoom,
    updateZoom,
    deleteZoom,
    // Speed
    addSpeed,
    updateSpeed,
    deleteSpeed,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    duplicateAnnotation,
    setGlobalSpeed,
    updateCameraOverlay,
    updateAudioMix,
    updateColorCorrection,
  };
}
