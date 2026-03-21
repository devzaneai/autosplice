import { describe, it, expect } from "vitest";
import {
  sampleToSeconds,
  analysisTimeToTimeline,
  snapToFrame,
} from "../../src/js/engine/time-mapper";

describe("sampleToSeconds", () => {
  it("converts sample index to seconds at 44100 Hz", () => {
    expect(sampleToSeconds(44100, 44100)).toBeCloseTo(1.0, 5);
  });

  it("converts sample index to seconds at 48000 Hz", () => {
    expect(sampleToSeconds(48000, 48000)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for sample index 0", () => {
    expect(sampleToSeconds(0, 44100)).toBe(0);
  });
});

describe("snapToFrame", () => {
  it("snaps to nearest frame at 30fps", () => {
    expect(snapToFrame(0.517, 30)).toBeCloseTo(16 / 30, 5);
  });

  it("snaps to nearest frame at 24fps", () => {
    expect(snapToFrame(0.5, 24)).toBeCloseTo(12 / 24, 5);
  });

  it("snaps to nearest frame at 23.976fps", () => {
    const snapped = snapToFrame(1.0, 23.976);
    expect(snapped).toBeCloseTo(24 / 23.976, 3);
  });
});

describe("analysisTimeToTimeline", () => {
  it("maps analysis time to timeline position", () => {
    const result = analysisTimeToTimeline(7, 10, 5, 30);
    expect(result).toBeCloseTo(12, 1);
  });

  it("frame-snaps the result", () => {
    const result = analysisTimeToTimeline(5.017, 0, 0, 30);
    expect(result).toBeCloseTo(151 / 30, 4);
  });
});
