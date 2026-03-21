import type { JumpCutSettings, MultiCamSettings } from "./types";

export const DEFAULT_JUMP_CUT: JumpCutSettings = {
  silenceThresholdDb: -40,
  minSilenceDurationMs: 500,
  paddingMs: 150,
  mode: "delete",
} as const;

export const DEFAULT_MULTI_CAM: MultiCamSettings = {
  speakerMappings: [],
  minCutDurationSeconds: 3,
  crosstalkSensitivityDb: 6,
  wideShotTrackIndex: null,
  wideShotFrequencySeconds: 30,
  insertWideOnTransitions: true,
} as const;

export const ANALYSIS_CONSTANTS = {
  FRAME_LENGTH: 2048,
  HOP_SIZE: 512,
  DEFAULT_SAMPLE_RATE: 44100,
  HYSTERESIS_RATIO: 0.5,
} as const;
