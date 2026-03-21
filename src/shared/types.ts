// ---- Jump Cut Types ----

export type CutMode = "delete" | "disable";

export interface JumpCutSettings {
  readonly silenceThresholdDb: number;
  readonly minSilenceDurationMs: number;
  readonly paddingMs: number;
  readonly mode: CutMode;
}

export interface SilenceRegion {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface JumpCutResult {
  readonly cutList: readonly CutEntry[];
  readonly totalDuration: number;
  readonly keptDuration: number;
  readonly silenceCount: number;
}

export interface CutEntry {
  readonly startTimecode: number;
  readonly endTimecode: number;
  readonly action: CutMode;
}

// ---- Multi-Cam Types ----

export interface SpeakerMapping {
  readonly audioTrackIndex: number;
  readonly videoTrackIndex: number;
  readonly speakerName: string;
}

export interface MultiCamSettings {
  readonly speakerMappings: readonly SpeakerMapping[];
  readonly minCutDurationSeconds: number;
  readonly crosstalkSensitivityDb: number;
  readonly wideShotTrackIndex: number | null;
  readonly wideShotFrequencySeconds: number;
  readonly insertWideOnTransitions: boolean;
}

export interface CameraSwitch {
  readonly cameraTrackIndex: number;
  readonly startTimecode: number;
  readonly endTimecode: number;
}

export interface MultiCamResult {
  readonly switches: readonly CameraSwitch[];
  readonly totalCuts: number;
  readonly averageShotDuration: number;
}

// ---- Audio Analysis Types ----

export interface AudioFrameData {
  readonly rmsValues: Float32Array;
  readonly sampleRate: number;
  readonly frameLength: number;
  readonly hopSize: number;
  readonly totalFrames: number;
  readonly durationSeconds: number;
}

// ---- Premiere Pro Bridge Types ----

export interface ClipInfo {
  readonly mediaPath: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly inPoint: number;
  readonly outPoint: number;
  readonly trackIndex: number;
}

export interface SequenceInfo {
  readonly name: string;
  readonly frameRate: number;
  readonly durationSeconds: number;
  readonly audioTrackCount: number;
  readonly videoTrackCount: number;
  readonly inPoint: number | null;
  readonly outPoint: number | null;
  readonly selectedClips: readonly ClipInfo[];
}

// ---- Progress Types ----

export type AnalysisPhase =
  | "extracting"
  | "analyzing"
  | "detecting"
  | "generating"
  | "complete"
  | "error";

export interface AnalysisProgress {
  readonly phase: AnalysisPhase;
  readonly percent: number;
  readonly message: string;
}
