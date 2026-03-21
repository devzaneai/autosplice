import { describe, it, expect } from "vitest";
import { detectSilence, applyPadding, filterByDuration } from "../../src/js/engine/silence-detector";
import type { SilenceRegion } from "../../src/shared/types";

describe("detectSilence", () => {
  it("detects silence below threshold", () => {
    const dbfsValues = new Float32Array([-20, -20, -20, -50, -50, -50, -20, -20]);
    const hopSize = 512;
    const sampleRate = 44100;
    const regions = detectSilence(dbfsValues, -40, hopSize, sampleRate);
    expect(regions.length).toBe(1);
    expect(regions[0].startSeconds).toBeCloseTo(3 * hopSize / sampleRate, 3);
    expect(regions[0].endSeconds).toBeCloseTo(6 * hopSize / sampleRate, 3);
  });

  it("returns empty array for all-speech audio", () => {
    const dbfsValues = new Float32Array(10).fill(-20);
    const regions = detectSilence(dbfsValues, -40, 512, 44100);
    expect(regions.length).toBe(0);
  });

  it("returns one region for all-silence audio", () => {
    const dbfsValues = new Float32Array(10).fill(-50);
    const regions = detectSilence(dbfsValues, -40, 512, 44100);
    expect(regions.length).toBe(1);
  });

  it("detects multiple silence regions", () => {
    const dbfsValues = new Float32Array([-20, -50, -50, -20, -20, -50, -20]);
    const regions = detectSilence(dbfsValues, -40, 512, 44100);
    expect(regions.length).toBe(2);
  });
});

describe("filterByDuration", () => {
  it("removes silence shorter than minimum duration", () => {
    const regions: SilenceRegion[] = [
      { startSeconds: 0, endSeconds: 0.1 },
      { startSeconds: 1, endSeconds: 2 },
    ];
    const filtered = filterByDuration(regions, 500);
    expect(filtered.length).toBe(1);
    expect(filtered[0].startSeconds).toBe(1);
  });

  it("keeps all regions above minimum duration", () => {
    const regions: SilenceRegion[] = [
      { startSeconds: 0, endSeconds: 1 },
      { startSeconds: 2, endSeconds: 3 },
    ];
    const filtered = filterByDuration(regions, 500);
    expect(filtered.length).toBe(2);
  });
});

describe("applyPadding", () => {
  it("shrinks silence regions by padding on each side", () => {
    const regions: SilenceRegion[] = [{ startSeconds: 1.0, endSeconds: 3.0 }];
    const padded = applyPadding(regions, 150, 5.0);
    expect(padded.length).toBe(1);
    expect(padded[0].startSeconds).toBeCloseTo(1.15, 3);
    expect(padded[0].endSeconds).toBeCloseTo(2.85, 3);
  });

  it("removes regions that become zero or negative after padding", () => {
    const regions: SilenceRegion[] = [{ startSeconds: 1.0, endSeconds: 1.2 }];
    const padded = applyPadding(regions, 150, 5.0);
    expect(padded.length).toBe(0);
  });

  it("clamps padding to not go below 0 or above total duration", () => {
    const regions: SilenceRegion[] = [{ startSeconds: 0.0, endSeconds: 1.0 }];
    const padded = applyPadding(regions, 150, 5.0);
    expect(padded[0].startSeconds).toBe(0.15);
  });
});
