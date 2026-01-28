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
