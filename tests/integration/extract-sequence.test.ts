import { describe, it, expect } from "vitest";

/**
 * Root cause analysis: Premiere's QE extract() behaves as LIFT, not EXTRACT.
 * It removes clips but doesn't close the gap.
 *
 * Solution: Don't rely on extract(). Instead:
 * 1. Razor at all cut points
 * 2. Disable (not delete) the silent clips
 * 3. Export/rebuild the sequence without disabled clips
 *
 * OR the simpler approach:
 * 1. Razor at all cut points
 * 2. Identify clips in silent regions
 * 3. Select them
 * 4. Use Premiere's native ripple delete
 *
 * OR the approach we'll implement:
 * 1. Razor at all cut points
 * 2. Remove silent clips via lift (extract)
 * 3. Manually close all gaps by shifting clips left
 */

interface Segment {
  start: number;
  end: number;
  label: string;
}

// Simulate a lift: remove content but DON'T shift anything
const simulateLift = (segs: Segment[], inPt: number, outPt: number): Segment[] => {
  return segs.filter(s => !(s.start >= inPt - 0.001 && s.end <= outPt + 0.001));
};

// Close all gaps: shift each segment left to be flush with the previous one
const closeAllGaps = (segs: Segment[]): Segment[] => {
  if (segs.length === 0) return [];
  const result: Segment[] = [];
  let currentTime = 0;

  // Sort by start time first
  const sorted = [...segs].sort((a, b) => a.start - b.start);

  for (const seg of sorted) {
    const duration = seg.end - seg.start;
    result.push({
      start: currentTime,
      end: currentTime + duration,
      label: seg.label,
    });
    currentTime += duration;
  }

  return result;
};

describe("Lift + close gaps approach", () => {
  it("produces gapless timeline from multiple silence regions", () => {
    // Timeline: speech(0-2), silence(2-3), speech(3-6), silence(6-7), speech(7-10)
    const timeline: Segment[] = [
      { start: 0, end: 2, label: "speech1" },
      { start: 2, end: 3, label: "silence1" },
      { start: 3, end: 6, label: "speech2" },
      { start: 6, end: 7, label: "silence2" },
      { start: 7, end: 10, label: "speech3" },
    ];

    // Step 1: Lift both silent regions (order doesn't matter for lift)
    let result = simulateLift(timeline, 2, 3);
    result = simulateLift(result, 6, 7);

    // After lift: gaps remain
    expect(result).toEqual([
      { start: 0, end: 2, label: "speech1" },
      { start: 3, end: 6, label: "speech2" },
      { start: 7, end: 10, label: "speech3" },
    ]);
    // GAP at 2-3 and 6-7

    // Step 2: Close all gaps
    result = closeAllGaps(result);

    expect(result).toEqual([
      { start: 0, end: 2, label: "speech1" },
      { start: 2, end: 5, label: "speech2" },
      { start: 5, end: 8, label: "speech3" },
    ]);

    // No gaps
    for (let i = 1; i < result.length; i++) {
      expect(result[i].start).toBe(result[i - 1].end);
    }
    // Total: 8s (was 10s, removed 2s of silence)
    expect(result[result.length - 1].end).toBe(8);
  });

  it("handles adjacent silence regions", () => {
    const timeline: Segment[] = [
      { start: 0, end: 1, label: "speech" },
      { start: 1, end: 3, label: "silence1" },
      { start: 3, end: 4, label: "silence2" },
      { start: 4, end: 6, label: "speech2" },
    ];

    let result = simulateLift(timeline, 1, 3);
    result = simulateLift(result, 3, 4);
    result = closeAllGaps(result);

    expect(result).toEqual([
      { start: 0, end: 1, label: "speech" },
      { start: 1, end: 3, label: "speech2" },
    ]);
  });

  it("handles silence at the very beginning", () => {
    const timeline: Segment[] = [
      { start: 0, end: 2, label: "silence" },
      { start: 2, end: 5, label: "speech" },
    ];

    let result = simulateLift(timeline, 0, 2);
    result = closeAllGaps(result);

    expect(result).toEqual([
      { start: 0, end: 3, label: "speech" },
    ]);
  });

  it("handles silence at the very end", () => {
    const timeline: Segment[] = [
      { start: 0, end: 5, label: "speech" },
      { start: 5, end: 8, label: "silence" },
    ];

    let result = simulateLift(timeline, 5, 8);
    result = closeAllGaps(result);

    expect(result).toEqual([
      { start: 0, end: 5, label: "speech" },
    ]);
  });
});
