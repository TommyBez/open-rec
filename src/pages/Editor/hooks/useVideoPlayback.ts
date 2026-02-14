import { useEffect, useRef, useCallback, startTransition } from "react";
import { Project } from "../../../types/project";

interface UseVideoPlaybackOptions {
  project: Project | null;
  isPlaying: boolean;
  duration: number;
  enabledSegments: Array<{ startTime: number; endTime: number }>;
  currentPlaybackRate: number;
  playbackRateMultiplier: number;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  patchProject: (updater: (project: Project) => Project) => void;
}

export function useVideoPlayback({
  project,
  isPlaying,
  duration,
  enabledSegments,
  currentPlaybackRate,
  playbackRateMultiplier,
  setIsPlaying,
  setCurrentTime,
  setDuration,
  patchProject,
}: UseVideoPlaybackOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentSpeedSegmentRef = useRef<string | null>(null);

  // Extract speed effects for narrower dependency
  const speedEffects = project?.edits.speed;

  // Check if a time is within any enabled segment
  const isTimeInSegment = useCallback((time: number) => {
    return enabledSegments.some(
      (seg) => time >= seg.startTime && time < seg.endTime
    );
  }, [enabledSegments]);

  // Find the next segment start time after a given time
  const findNextSegmentStart = useCallback((time: number) => {
    for (const seg of enabledSegments) {
      if (seg.startTime > time) {
        return seg.startTime;
      }
    }
    return null;
  }, [enabledSegments]);

  // Video metadata and ended handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const actualDuration = video.duration;
      setDuration(actualDuration);

      patchProject((currentProject) => {
        if (Math.abs(currentProject.duration - actualDuration) <= 0.1) {
          return currentProject;
        }
        return {
          ...currentProject,
          duration: actualDuration,
          edits: {
            ...currentProject.edits,
            segments: currentProject.edits.segments
              .map((seg) => ({
                ...seg,
                startTime: Math.max(0, Math.min(seg.startTime, actualDuration)),
                endTime: Math.max(0, Math.min(seg.endTime, actualDuration)),
              }))
              .filter((seg) => seg.endTime > seg.startTime),
          },
        };
      });
    };
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, [patchProject, setDuration, setIsPlaying]);

  // RAF loop for smooth time updates during playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || !speedEffects) return;

    let rafId: number;
    let lastUIUpdateTime = 0;
    const uiUpdateInterval = 1000 / 30;
    
    const updateTime = (timestamp: number) => {
      const videoTime = video.currentTime;
      
      const activeSpeedSegment = speedEffects.find(
        (s) => videoTime >= s.startTime && videoTime < s.endTime
      );
      const newSegmentId = activeSpeedSegment?.id ?? null;
      
      if (newSegmentId !== currentSpeedSegmentRef.current) {
        currentSpeedSegmentRef.current = newSegmentId;
        const newRate = (activeSpeedSegment?.speed ?? 1) * playbackRateMultiplier;
        if (video.playbackRate !== newRate) {
          video.playbackRate = newRate;
        }
      }
      
      if (timestamp - lastUIUpdateTime >= uiUpdateInterval) {
        startTransition(() => setCurrentTime(videoTime));
        lastUIUpdateTime = timestamp;
      }
      
      rafId = requestAnimationFrame(updateTime);
    };
    
    rafId = requestAnimationFrame(updateTime);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, speedEffects, playbackRateMultiplier, setCurrentTime]);

  // Update video playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const effectiveRate = currentPlaybackRate * playbackRateMultiplier;
    if (video.playbackRate !== effectiveRate) {
      video.playbackRate = effectiveRate;
    }
  }, [currentPlaybackRate, playbackRateMultiplier]);

  // Segment-aware playback: skip gaps
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || enabledSegments.length === 0) return;

    const checkAndSkip = () => {
      const time = video.currentTime;
      
      if (!isTimeInSegment(time)) {
        const nextStart = findNextSegmentStart(time);
        if (nextStart !== null) {
          video.currentTime = nextStart;
        } else {
          video.pause();
          setIsPlaying(false);
        }
      }
    };

    const interval = setInterval(checkAndSkip, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, enabledSegments, isTimeInSegment, findNextSegmentStart, setIsPlaying]);

  // Memoized playback controls
  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, [setCurrentTime]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      if (!isTimeInSegment(video.currentTime)) {
        const nextStart = findNextSegmentStart(video.currentTime);
        if (nextStart !== null) {
          video.currentTime = nextStart;
        } else if (enabledSegments.length > 0) {
          video.currentTime = enabledSegments[0].startTime;
        }
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, isTimeInSegment, findNextSegmentStart, enabledSegments, setIsPlaying]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 5);
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(duration, video.currentTime + 5);
  }, [duration]);

  return {
    videoRef,
    seek,
    togglePlay,
    skipBackward,
    skipForward,
    isTimeInSegment,
    findNextSegmentStart,
  };
}
