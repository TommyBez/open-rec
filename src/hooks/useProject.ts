import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Project, Segment, ZoomEffect, SpeedEffect } from "../types/project";

const MAX_HISTORY_SIZE = 50;

export function useProject(initialProject: Project | null) {
  const [project, setProject] = useState<Project | null>(initialProject);
  const [isDirty, setIsDirty] = useState(false);
  
  // History for undo functionality
  const historyRef = useRef<Project[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Generate a unique ID for new effects
  const generateId = () => crypto.randomUUID();

  // Push current state to history before making changes
  const pushToHistory = useCallback((currentProject: Project) => {
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY_SIZE - 1)),
      currentProject,
    ];
    setCanUndo(true);
  }, []);

  // Undo: restore previous state
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    
    const previousState = historyRef.current.pop();
    if (previousState) {
      setProject(previousState);
      setIsDirty(true);
      setCanUndo(historyRef.current.length > 0);
    }
  }, []);

  // Update project and mark as dirty
  const updateProject = useCallback((updater: (p: Project) => Project) => {
    setProject((prev) => {
      if (!prev) return prev;
      // Save current state to history before updating
      pushToHistory(prev);
      const updated = updater(prev);
      setIsDirty(true);
      return updated;
    });
  }, [pushToHistory]);

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
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        segments: p.edits.segments.map((s) =>
          s.id === segmentId ? { ...s, enabled: !s.enabled } : s
        ),
      },
    }));
  }, [updateProject]);

  // Delete a segment (keeps source video time references intact)
  const deleteSegment = useCallback((segmentId: string) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        segments: p.edits.segments.filter((s) => s.id !== segmentId),
      },
    }));
  }, [updateProject]);

  // Add a zoom effect
  const addZoom = useCallback((startTime: number, endTime: number, scale: number = 1.5) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        zoom: [
          ...p.edits.zoom,
          {
            id: generateId(),
            startTime,
            endTime,
            scale,
            x: 0,
            y: 0,
          },
        ],
      },
    }));
  }, [updateProject]);

  // Update a zoom effect
  const updateZoom = useCallback((zoomId: string, updates: Partial<ZoomEffect>) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        zoom: p.edits.zoom.map((z) =>
          z.id === zoomId ? { ...z, ...updates } : z
        ),
      },
    }));
  }, [updateProject]);

  // Delete a zoom effect
  const deleteZoom = useCallback((zoomId: string) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        zoom: p.edits.zoom.filter((z) => z.id !== zoomId),
      },
    }));
  }, [updateProject]);

  // Add a speed effect
  const addSpeed = useCallback((startTime: number, endTime: number, speed: number = 1.0) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        speed: [
          ...p.edits.speed,
          {
            id: generateId(),
            startTime,
            endTime,
            speed,
          },
        ],
      },
    }));
  }, [updateProject]);

  // Update a speed effect
  const updateSpeed = useCallback((speedId: string, updates: Partial<SpeedEffect>) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        speed: p.edits.speed.map((s) =>
          s.id === speedId ? { ...s, ...updates } : s
        ),
      },
    }));
  }, [updateProject]);

  // Delete a speed effect
  const deleteSpeed = useCallback((speedId: string) => {
    updateProject((p) => ({
      ...p,
      edits: {
        ...p.edits,
        speed: p.edits.speed.filter((s) => s.id !== speedId),
      },
    }));
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

  return {
    project,
    setProject,
    isDirty,
    saveProject,
    // History
    canUndo,
    undo,
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
    setGlobalSpeed,
  };
}
