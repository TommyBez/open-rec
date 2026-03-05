import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

function normalizePeaks(peaks: number[]): number[] {
  const max = peaks.reduce((largest, value) => Math.max(largest, value), 0);
  if (max <= 0) return peaks.map(() => 0);
  return peaks.map((value) => value / max);
}

export function useWaveformData(filePath?: string, sampleCount: number = 160): number[] {
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (!filePath) {
      setWaveform([]);
      return;
    }

    let cancelled = false;
    const context = new AudioContext();

    const loadWaveform = async () => {
      try {
        const response = await fetch(convertFileSrc(filePath));
        const bytes = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(bytes.slice(0));
        const channelData = audioBuffer.getChannelData(0);
        const chunkSize = Math.max(1, Math.floor(channelData.length / sampleCount));

        const peaks = new Array(sampleCount).fill(0).map((_, index) => {
          const start = index * chunkSize;
          const end = Math.min(channelData.length, start + chunkSize);
          let peak = 0;
          for (let i = start; i < end; i += 1) {
            peak = Math.max(peak, Math.abs(channelData[i]));
          }
          return peak;
        });

        if (!cancelled) {
          setWaveform(normalizePeaks(peaks));
        }
      } catch (error) {
        console.warn("Failed to load waveform data", error);
        if (!cancelled) {
          setWaveform([]);
        }
      } finally {
        if (context.state !== "closed") {
          context.close().catch(() => undefined);
        }
      }
    };

    loadWaveform().catch(() => undefined);

    return () => {
      cancelled = true;
      if (context.state !== "closed") {
        context.close().catch(() => undefined);
      }
    };
  }, [filePath, sampleCount]);

  return waveform;
}
