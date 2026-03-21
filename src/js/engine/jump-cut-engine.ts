import { extractAudio, cleanupTempFiles } from "./ffmpeg-bridge";
import { readWav } from "./wav-reader";
import { analyzeFrames } from "./analyzer";
import { detectSilence, filterByDuration, applyPadding } from "./silence-detector";
import { analysisTimeToTimeline } from "./time-mapper";
import { fs } from "../lib/cep/node";
import { evalTS } from "../lib/utils/bolt";
import { ANALYSIS_CONSTANTS } from "../../shared/defaults";
import type {
  JumpCutSettings, JumpCutResult, CutEntry,
  ClipInfo, AnalysisProgress,
} from "../../shared/types";

type ProgressCallback = (progress: AnalysisProgress) => void;

export const analyzeJumpCuts = async (
  settings: JumpCutSettings,
  onProgress: ProgressCallback
): Promise<JumpCutResult> => {
  try {
    onProgress({ phase: "extracting", percent: 5, message: "Reading sequence info..." });
    const seqInfo = await evalTS("getSequenceInfo");

    if (!seqInfo || (seqInfo as any).error) {
      throw new Error((seqInfo as any)?.error || "No active sequence");
    }

    let clips: ClipInfo[];
    if ((seqInfo as any).selectedClips.length > 0) {
      clips = (seqInfo as any).selectedClips;
    } else if ((seqInfo as any).inPoint !== null && (seqInfo as any).outPoint !== null) {
      const allClips = await evalTS("getAudioTrackClips", 0) as unknown as ClipInfo[];
      clips = allClips.filter(
        (c) => c.endTime > (seqInfo as any).inPoint && c.startTime < (seqInfo as any).outPoint
      );
    } else {
      clips = await evalTS("getAudioTrackClips", 0) as unknown as ClipInfo[];
    }

    if (!clips || clips.length === 0) {
      throw new Error("No clips found to analyze. Select clips or check audio tracks.");
    }

    onProgress({ phase: "extracting", percent: 15, message: "Extracting audio..." });
    const wavPath = await extractAudio(clips[0].mediaPath, "jumpcut-analysis", true);

    onProgress({ phase: "analyzing", percent: 40, message: "Analyzing audio levels..." });
    const wavBuffer = fs.readFileSync(wavPath);
    const wavData = readWav(wavBuffer);

    const frameData = analyzeFrames(
      wavData.samples,
      wavData.sampleRate,
      ANALYSIS_CONSTANTS.FRAME_LENGTH,
      ANALYSIS_CONSTANTS.HOP_SIZE
    );

    onProgress({ phase: "detecting", percent: 65, message: "Detecting silence..." });
    let silenceRegions = detectSilence(
      frameData.rmsValues,
      settings.silenceThresholdDb,
      ANALYSIS_CONSTANTS.HOP_SIZE,
      wavData.sampleRate
    );

    silenceRegions = filterByDuration(silenceRegions, settings.minSilenceDurationMs);

    silenceRegions = applyPadding(
      silenceRegions,
      settings.paddingMs,
      frameData.durationSeconds
    );

    onProgress({ phase: "generating", percent: 85, message: "Generating cut list..." });
    const frameRate = (seqInfo as any).frameRate || 30;
    const cutList: CutEntry[] = silenceRegions.map((region) => ({
      startTimecode: analysisTimeToTimeline(
        region.startSeconds,
        clips[0].startTime,
        clips[0].inPoint,
        frameRate
      ),
      endTimecode: analysisTimeToTimeline(
        region.endSeconds,
        clips[0].startTime,
        clips[0].inPoint,
        frameRate
      ),
      action: settings.mode,
    }));

    const totalDuration = frameData.durationSeconds;
    const silenceDuration = silenceRegions.reduce(
      (sum, r) => sum + (r.endSeconds - r.startSeconds), 0
    );

    onProgress({ phase: "complete", percent: 100, message: "Analysis complete" });

    return {
      cutList,
      totalDuration,
      keptDuration: totalDuration - silenceDuration,
      silenceCount: cutList.length,
    };
  } finally {
    cleanupTempFiles();
  }
};
