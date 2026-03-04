import { useCallback, useMemo } from "react";
import type { Segment } from "../../../types/project";

export interface SegmentDisplayInfo {
  displayStart: number;
  displayEnd: number;
  segment: Segment;
  clampedStart: number;
  clampedEnd: number;
}

export function useTimelineDisplayMetrics(segments: Segment[], duration: number) {
  const { segmentDisplayInfo, editedDuration, sourceToDisplayTime, displayToSourceTime } = useMemo(() => {
    const sortedSegments = [...segments]
      .filter((segment) => segment.enabled)
      .sort((a, b) => a.startTime - b.startTime);

    let displayOffset = 0;
    const displayInfo = new Map<string, SegmentDisplayInfo>();

    for (const segment of sortedSegments) {
      const clampedStart = Math.max(0, Math.min(segment.startTime, duration));
      const clampedEnd = Math.max(0, Math.min(segment.endTime, duration));
      const segmentDuration = Math.max(0, clampedEnd - clampedStart);

      if (segmentDuration <= 0) continue;
      displayInfo.set(segment.id, {
        displayStart: displayOffset,
        displayEnd: displayOffset + segmentDuration,
        segment,
        clampedStart,
        clampedEnd,
      });
      displayOffset += segmentDuration;
    }

    const totalEditedDuration = displayOffset > 0 ? displayOffset : duration;

    const sourceToDisplay = (sourceTime: number): number => {
      let displayTime = 0;
      for (const segment of sortedSegments) {
        const info = displayInfo.get(segment.id);
        if (!info) continue;
        if (sourceTime >= info.clampedStart && sourceTime <= info.clampedEnd) {
          return info.displayStart + (sourceTime - info.clampedStart);
        }
        if (sourceTime > info.clampedEnd) {
          displayTime = info.displayEnd;
        }
      }
      return displayTime;
    };

    const displayToSource = (displayTime: number): number => {
      for (const segment of sortedSegments) {
        const info = displayInfo.get(segment.id);
        if (!info) continue;
        if (displayTime >= info.displayStart && displayTime <= info.displayEnd) {
          return info.clampedStart + (displayTime - info.displayStart);
        }
      }
      if (sortedSegments.length > 0) {
        const lastSegment = sortedSegments[sortedSegments.length - 1];
        const lastInfo = displayInfo.get(lastSegment.id);
        if (lastInfo) return lastInfo.clampedEnd;
      }
      return Math.min(displayTime, duration);
    };

    return {
      segmentDisplayInfo: displayInfo,
      editedDuration: totalEditedDuration,
      sourceToDisplayTime: sourceToDisplay,
      displayToSourceTime: displayToSource,
    };
  }, [segments, duration]);

  const timelineDuration = editedDuration;

  const snapDisplayTimes = useMemo(() => {
    const points = new Set<number>([0, timelineDuration]);
    segmentDisplayInfo.forEach((info) => {
      points.add(info.displayStart);
      points.add(info.displayEnd);
    });
    return Array.from(points).sort((a, b) => a - b);
  }, [segmentDisplayInfo, timelineDuration]);

  const getSnappedDisplayTime = useCallback(
    (displayTime: number) => {
      const snapThreshold = Math.max(timelineDuration * 0.005, 0.15);
      let snapped = displayTime;
      for (const point of snapDisplayTimes) {
        if (Math.abs(displayTime - point) <= snapThreshold) {
          snapped = point;
          break;
        }
      }
      return snapped;
    },
    [snapDisplayTimes, timelineDuration]
  );

  const markers = useMemo(() => {
    const timelineMarkers: { time: number; label: string }[] = [];
    const interval = timelineDuration > 300 ? 60 : timelineDuration > 60 ? 30 : 10;
    for (let time = 0; time <= timelineDuration; time += interval) {
      const mins = Math.floor(time / 60);
      const secs = time % 60;
      timelineMarkers.push({
        time,
        label: `${mins}:${secs.toString().padStart(2, "0")}`,
      });
    }
    return timelineMarkers;
  }, [timelineDuration]);

  return {
    segmentDisplayInfo,
    editedDuration,
    timelineDuration,
    sourceToDisplayTime,
    displayToSourceTime,
    getSnappedDisplayTime,
    markers,
  };
}
