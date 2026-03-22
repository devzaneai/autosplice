import type {
  JumpCutSettings,
  MultiCamSettings,
  FillerSettings,
  AutoZoomSettings,
  FullEditSettings,
} from "./types";

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

export const DEFAULT_FILLER_WORDS: readonly string[] = [
  "um",
  "umm",
  "uh",
  "uhh",
  "hmm",
  "hm",
  "like",
  "you know",
  "basically",
  "actually",
  "so",
  "right",
  "i mean",
] as const;

export const DEFAULT_FILLER_SETTINGS: FillerSettings = {
  enabledFillers: [...DEFAULT_FILLER_WORDS],
  mode: "markers",
} as const;

export const DEFAULT_AUTO_ZOOM: AutoZoomSettings = {
  enabled: false,
  zoomPercent: 108,
  animated: false,
  easeDurationSeconds: 0.5,
} as const;

export const DEFAULT_FULL_EDIT: FullEditSettings = {
  multiCam: DEFAULT_MULTI_CAM,
  jumpCut: DEFAULT_JUMP_CUT,
  autoZoom: DEFAULT_AUTO_ZOOM,
} as const;
