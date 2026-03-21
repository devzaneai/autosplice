import { describe, it, expect } from "vitest";
import { calculateRms, rmsToDbfs, analyzeFrames } from "../../src/js/engine/analyzer";

describe("calculateRms", () => {
  it("returns 0 for silent audio", () => {
    const silence = new Float32Array(2048).fill(0);
    expect(calculateRms(silence)).toBe(0);
  });

  it("returns correct RMS for a known signal", () => {
    const signal = new Float32Array(2048).fill(0.5);
    expect(calculateRms(signal)).toBeCloseTo(0.5, 5);
  });

  it("returns correct RMS for a sine wave", () => {
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    }
    expect(calculateRms(samples)).toBeCloseTo(1 / Math.sqrt(2), 2);
  });
});

describe("rmsToDbfs", () => {
  it("returns -Infinity for zero RMS", () => {
    expect(rmsToDbfs(0)).toBe(-Infinity);
  });

  it("returns 0 dBFS for full scale (RMS = 1.0)", () => {
    expect(rmsToDbfs(1.0)).toBeCloseTo(0, 5);
  });

  it("returns -6 dBFS for half amplitude", () => {
    expect(rmsToDbfs(0.5)).toBeCloseTo(-6.02, 1);
  });

  it("returns -20 dBFS for 0.1 amplitude", () => {
    expect(rmsToDbfs(0.1)).toBeCloseTo(-20, 1);
  });
});

describe("analyzeFrames", () => {
  it("produces correct number of frames", () => {
    const sampleRate = 44100;
    const duration = 1.0;
    const samples = new Float32Array(sampleRate * duration).fill(0);
    const result = analyzeFrames(samples, sampleRate, 2048, 512);
    const expectedFrames = Math.floor((samples.length - 2048) / 512) + 1;
    expect(result.totalFrames).toBe(expectedFrames);
  });

  it("returns dBFS values for each frame", () => {
    const samples = new Float32Array(4096).fill(0.5);
    const result = analyzeFrames(samples, 44100, 2048, 512);
    expect(result.rmsValues.length).toBe(result.totalFrames);
    for (let i = 0; i < result.totalFrames; i++) {
      expect(result.rmsValues[i]).toBeCloseTo(-6.02, 0);
    }
  });
});
