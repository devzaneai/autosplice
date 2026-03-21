import { describe, it, expect } from "vitest";
import {
  detectActiveSpeaker,
  applyHysteresis,
  enforceMinCutDuration,
} from "../../src/js/engine/speaker-detector";

describe("detectActiveSpeaker", () => {
  it("identifies the loudest channel when differential exceeds sensitivity", () => {
    const channelDbfs = [[-15, -30]];
    const result = detectActiveSpeaker(channelDbfs, 6);
    expect(result[0]).toBe(0);
  });

  it("returns -1 when differential is below sensitivity", () => {
    const channelDbfs = [[-15, -17]];
    const result = detectActiveSpeaker(channelDbfs, 6);
    expect(result[0]).toBe(-1);
  });

  it("returns -1 when all channels are silent", () => {
    const channelDbfs = [[-Infinity, -Infinity]];
    const result = detectActiveSpeaker(channelDbfs, 6);
    expect(result[0]).toBe(-1);
  });

  it("handles multiple frames", () => {
    const channelDbfs = [
      [-15, -30],
      [-30, -12],
      [-20, -22],
    ];
    const result = detectActiveSpeaker(channelDbfs, 6);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(1);
    expect(result[2]).toBe(-1);
  });
});

describe("applyHysteresis", () => {
  it("holds current speaker during brief ambiguous periods", () => {
    const rawSpeakers = [0, 0, 0, -1, -1, 0, 0];
    const result = applyHysteresis(rawSpeakers);
    expect(result[3]).toBe(0);
    expect(result[4]).toBe(0);
  });

  it("switches speaker when a new speaker is clearly detected", () => {
    const rawSpeakers = [0, 0, 1, 1, 1];
    const result = applyHysteresis(rawSpeakers);
    expect(result[2]).toBe(1);
  });
});

describe("enforceMinCutDuration", () => {
  it("merges short segments into neighbors", () => {
    const segments = [
      { speaker: 0, startFrame: 0, endFrame: 50 },
      { speaker: 1, startFrame: 50, endFrame: 60 },
      { speaker: 0, startFrame: 60, endFrame: 110 },
    ];
    const hopSize = 512;
    const sampleRate = 44100;
    const result = enforceMinCutDuration(segments, 3, hopSize, sampleRate);
    expect(result.length).toBe(1);
    expect(result[0].speaker).toBe(0);
  });

  it("keeps segments that meet minimum duration", () => {
    const segments = [
      { speaker: 0, startFrame: 0, endFrame: 300 },
      { speaker: 1, startFrame: 300, endFrame: 600 },
    ];
    const result = enforceMinCutDuration(segments, 3, 512, 44100);
    expect(result.length).toBe(2);
  });
});
