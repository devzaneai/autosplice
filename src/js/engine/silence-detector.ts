import type { SilenceRegion } from "../../shared/types";

export const detectSilence = (
  dbfsValues: Float32Array,
  thresholdDb: number,
  hopSize: number,
  sampleRate: number
): SilenceRegion[] => {
  const regions: SilenceRegion[] = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < dbfsValues.length; i++) {
    const isSilent = dbfsValues[i] < thresholdDb;

    if (isSilent && silenceStart === null) {
      silenceStart = i;
    } else if (!isSilent && silenceStart !== null) {
      regions.push({
        startSeconds: (silenceStart * hopSize) / sampleRate,
        endSeconds: (i * hopSize) / sampleRate,
      });
      silenceStart = null;
    }
  }

  if (silenceStart !== null) {
    regions.push({
      startSeconds: (silenceStart * hopSize) / sampleRate,
      endSeconds: (dbfsValues.length * hopSize) / sampleRate,
    });
  }

  return regions;
};

export const filterByDuration = (
  regions: readonly SilenceRegion[],
  minDurationMs: number
): SilenceRegion[] => {
  const minSeconds = minDurationMs / 1000;
  return regions.filter((r) => r.endSeconds - r.startSeconds >= minSeconds);
};

export const applyPadding = (
  regions: readonly SilenceRegion[],
  paddingMs: number,
  totalDuration: number
): SilenceRegion[] => {
  const paddingSeconds = paddingMs / 1000;
  return regions
    .map((r) => ({
      startSeconds: Math.max(0, r.startSeconds + paddingSeconds),
      endSeconds: Math.min(totalDuration, r.endSeconds - paddingSeconds),
    }))
    .filter((r) => r.endSeconds > r.startSeconds);
};
