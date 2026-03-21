import type { AudioFrameData } from "../../../shared/types";

export const calculateRms = (samples: Float32Array): number => {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
};

export const rmsToDbfs = (rms: number): number => {
  if (rms === 0) return -Infinity;
  return 20 * Math.log10(rms);
};

export const analyzeFrames = (
  samples: Float32Array,
  sampleRate: number,
  frameLength: number,
  hopSize: number
): AudioFrameData => {
  const totalFrames = Math.floor((samples.length - frameLength) / hopSize) + 1;
  const rmsValues = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    const start = i * hopSize;
    const frame = samples.subarray(start, start + frameLength);
    const rms = calculateRms(frame);
    rmsValues[i] = rmsToDbfs(rms);
  }

  return {
    rmsValues,
    sampleRate,
    frameLength,
    hopSize,
    totalFrames,
    durationSeconds: samples.length / sampleRate,
  };
};
