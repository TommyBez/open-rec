import { useMemo } from "react";
import type { Project, Segment } from "../../../types/project";

interface EditedTimelineMetrics {
  enabledSegments: Segment[];
  editedDuration: number;
  sourceToEditedTime: (sourceTime: number) => number;
}

export function useEditedTimelineMetrics(
  project: Project | null,
  sourceDuration: number
): EditedTimelineMetrics {
  return useMemo(() => {
    if (!project) {
      return {
        enabledSegments: [],
        editedDuration: 0,
        sourceToEditedTime: () => 0,
      };
    }

    const sorted = project.edits.segments
      .filter((segment) => segment.enabled)
      .sort((a, b) => a.startTime - b.startTime);
    const speedEffects = project.edits.speed.filter(
      (effect) => Math.abs(effect.speed - 1.0) > 0.01
    );

    const getSpeedAt = (time: number): number => {
      for (const effect of speedEffects) {
        if (time >= effect.startTime && time < effect.endTime) {
          return effect.speed;
        }
      }
      return 1.0;
    };

    const getAdjustedDuration = (start: number, end: number): number => {
      if (speedEffects.length === 0) return end - start;
      const breakpoints = new Set<number>([start, end]);
      for (const effect of speedEffects) {
        if (effect.startTime > start && effect.startTime < end) {
          breakpoints.add(effect.startTime);
        }
        if (effect.endTime > start && effect.endTime < end) {
          breakpoints.add(effect.endTime);
        }
      }
      const sortedPoints = Array.from(breakpoints).sort((a, b) => a - b);
      let totalAdjusted = 0;
      for (let i = 0; i < sortedPoints.length - 1; i += 1) {
        const segmentStart = sortedPoints[i];
        const segmentEnd = sortedPoints[i + 1];
        totalAdjusted += (segmentEnd - segmentStart) / getSpeedAt(segmentStart);
      }
      return totalAdjusted;
    };

    let editedOffset = 0;
    const segmentInfo: Array<{
      clampedStart: number;
      clampedEnd: number;
      editedStart: number;
    }> = [];

    for (const segment of sorted) {
      const clampedStart = Math.max(0, Math.min(segment.startTime, sourceDuration));
      const clampedEnd = Math.max(0, Math.min(segment.endTime, sourceDuration));
      const segmentDuration = Math.max(0, clampedEnd - clampedStart);
      if (segmentDuration <= 0) continue;
      segmentInfo.push({ clampedStart, clampedEnd, editedStart: editedOffset });
      editedOffset += getAdjustedDuration(clampedStart, clampedEnd);
    }

    const sourceToEditedTime = (sourceTime: number): number => {
      for (const info of segmentInfo) {
        if (sourceTime >= info.clampedStart && sourceTime <= info.clampedEnd) {
          return info.editedStart + (sourceTime - info.clampedStart);
        }
      }
      return editedOffset;
    };

    return {
      enabledSegments: sorted,
      editedDuration: editedOffset || sourceDuration,
      sourceToEditedTime,
    };
  }, [project, sourceDuration]);
}
