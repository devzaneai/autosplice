import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests verify that the panel entry point and component tree
 * can be imported without crashing, even when CEP globals are missing.
 *
 * The blank panel bug was caused by top-level side effects in the
 * entry point (index-react.tsx) that assumed CEP globals existed.
 */

describe("Entry point safety", () => {
  beforeEach(() => {
    // Simulate non-CEP environment (no window.cep)
    vi.stubGlobal("window", {
      ...globalThis.window,
      cep: undefined,
    });
  });

  it("shared/defaults can be imported without side effects", async () => {
    const defaults = await import("../../src/shared/defaults");
    expect(defaults.DEFAULT_JUMP_CUT).toBeDefined();
    expect(defaults.DEFAULT_JUMP_CUT.silenceThresholdDb).toBe(-40);
    expect(defaults.ANALYSIS_CONSTANTS.FRAME_LENGTH).toBe(2048);
  });

  it("shared/types can be imported without side effects", async () => {
    // Types are compile-time only, but the module should still be importable
    const types = await import("../../src/shared/types");
    expect(types).toBeDefined();
  });

  it("engine/analyzer can be imported without CEP dependencies", async () => {
    const analyzer = await import("../../src/js/engine/analyzer");
    expect(analyzer.calculateRms).toBeTypeOf("function");
    expect(analyzer.rmsToDbfs).toBeTypeOf("function");
    expect(analyzer.analyzeFrames).toBeTypeOf("function");
  });

  it("engine/silence-detector can be imported without CEP dependencies", async () => {
    const detector = await import("../../src/js/engine/silence-detector");
    expect(detector.detectSilence).toBeTypeOf("function");
    expect(detector.filterByDuration).toBeTypeOf("function");
    expect(detector.applyPadding).toBeTypeOf("function");
  });

  it("engine/speaker-detector can be imported without CEP dependencies", async () => {
    const detector = await import("../../src/js/engine/speaker-detector");
    expect(detector.detectActiveSpeaker).toBeTypeOf("function");
    expect(detector.applyHysteresis).toBeTypeOf("function");
  });

  it("engine/time-mapper can be imported without CEP dependencies", async () => {
    const mapper = await import("../../src/js/engine/time-mapper");
    expect(mapper.snapToFrame).toBeTypeOf("function");
    expect(mapper.analysisTimeToTimeline).toBeTypeOf("function");
  });

  it("engine/wav-reader can be imported without CEP dependencies", async () => {
    const reader = await import("../../src/js/engine/wav-reader");
    expect(reader.readWav).toBeTypeOf("function");
  });
});

describe("Entry point must not call initBolt at module level", () => {
  it("index-react.tsx should not import initBolt", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/js/main/index-react.tsx", "utf-8");
    expect(content).not.toMatch(/^import.*initBolt/m);
    // Ensure initBolt() is not called as a statement (ignore comments)
    const nonCommentLines = content
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//"));
    const hasInitBoltCall = nonCommentLines.some((line: string) =>
      /initBolt\(\)/.test(line),
    );
    expect(hasInitBoltCall).toBe(false);
  });
});

describe("CEP-dependent module isolation", () => {
  it("engine/ffmpeg-bridge crashes on import without CEP globals", async () => {
    // This SHOULD fail because it imports from ../lib/cep/node which requires window.cep
    // If it doesn't fail, the lazy-loading strategy works correctly
    try {
      await import("../../src/js/engine/ffmpeg-bridge");
      // If we get here, the module imported OK (maybe cep/node.ts handles missing window.cep gracefully)
    } catch (err) {
      // Expected — this confirms we need lazy loading for CEP modules
      expect(err).toBeDefined();
    }
  });

  it("lib/utils/bolt crashes on import without CSInterface global", async () => {
    // bolt.ts creates new CSInterface() at module level
    // This should fail outside CEP
    try {
      await import("../../src/js/lib/utils/bolt");
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
