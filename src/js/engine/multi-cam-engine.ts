import { extractAudio, cleanupTempFiles } from "./ffmpeg-bridge";
import { readWav } from "./wav-reader";
import { analyzeFrames } from "./analyzer";
import {
  detectActiveSpeaker,
  applyHysteresis,
  segmentSpeakers,
  enforceMinCutDuration,
} from "./speaker-detector";
import { frameIndexToSeconds, analysisTimeToTimeline } from "./time-mapper";
import { fs } from "../lib/cep/node";
import { evalTS } from "../lib/utils/bolt";
import { ANALYSIS_CONSTANTS } from "../../shared/defaults";
import type {
  MultiCamSettings,
  MultiCamResult,
  CameraSwitch,
  AnalysisProgress,
  AudioFrameData,
} from "../../shared/types";

type ProgressCallback = (progress: AnalysisProgress) => void;

export const analyzeMultiCam = async (
  settings: MultiCamSettings,
  onProgress: ProgressCallback
): Promise<MultiCamResult> => {
  try {
    onProgress({ phase: "extracting", percent: 5, message: "Reading sequence info..." });
    const seqInfo = await evalTS("getSequenceInfo");

    if (!seqInfo || (seqInfo as any).error) {
      throw new Error((seqInfo as any)?.error || "No active sequence");
    }

    if (settings.speakerMappings.length < 2) {
      throw new Error("At least 2 speaker mappings are required for multi-cam editing.");
    }

    // Extract audio from each speaker's audio track
    const mappings = settings.speakerMappings;
    const wavPaths: string[] = [];

    for (let i = 0; i < mappings.length; i++) {
      const percent = 10 + Math.round((i / mappings.length) * 30);
      onProgress({
        phase: "extracting",
        percent,
        message: `Extracting audio for ${mappings[i].speakerName}...`,
      });

      const clips = await evalTS("getAudioTrackClips", mappings[i].audioTrackIndex) as unknown as any[];
      if (!clips || clips.length === 0) {
        throw new Error(`No clips found on audio track ${mappings[i].audioTrackIndex + 1}`);
      }

      const wavPath = await extractAudio(
        clips[0].mediaPath,
        `multicam-track-${mappings[i].audioTrackIndex}`,
        true
      );
      wavPaths.push(wavPath);
    }

    // Analyze all tracks
    onProgress({ phase: "analyzing", percent: 45, message: "Analyzing audio levels..." });
    const allFrameData: AudioFrameData[] = [];
    for (const wavPath of wavPaths) {
      const wavBuffer = fs.readFileSync(wavPath);
      const wavData = readWav(wavBuffer);
      const frameData = analyzeFrames(
        wavData.samples,
        wavData.sampleRate,
        ANALYSIS_CONSTANTS.FRAME_LENGTH,
        ANALYSIS_CONSTANTS.HOP_SIZE
      );
      allFrameData.push(frameData);
    }

    // Build per-frame dBFS matrix (frames x channels)
    const minFrames = Math.min(...allFrameData.map((fd) => fd.totalFrames));
    const channelDbfs: number[][] = [];
    for (let f = 0; f < minFrames; f++) {
      const frame: number[] = [];
      for (let ch = 0; ch < allFrameData.length; ch++) {
        frame.push(allFrameData[ch].rmsValues[f]);
      }
      channelDbfs.push(frame);
    }

    // Detect active speaker per frame
    onProgress({ phase: "detecting", percent: 65, message: "Detecting active speakers..." });
    const rawSpeakers = detectActiveSpeaker(channelDbfs, settings.crosstalkSensitivityDb);

    // Apply hysteresis to fill ambiguous frames
    const smoothedSpeakers = applyHysteresis(rawSpeakers);

    // Segment into contiguous blocks
    const segments = segmentSpeakers(smoothedSpeakers);

    // Enforce minimum cut duration
    const sampleRate = allFrameData[0]?.sampleRate || ANALYSIS_CONSTANTS.DEFAULT_SAMPLE_RATE;
    const enforcedSegments = enforceMinCutDuration(
      segments,
      settings.minCutDurationSeconds,
      ANALYSIS_CONSTANTS.HOP_SIZE,
      sampleRate
    );

    // Generate camera switches from segments
    onProgress({ phase: "generating", percent: 80, message: "Generating camera switches..." });
    const frameRate = (seqInfo as any).frameRate || 30;
    const firstClips = await evalTS("getAudioTrackClips", mappings[0].audioTrackIndex) as unknown as any[];
    const clipStartTime = firstClips[0]?.startTime || 0;
    const clipInPoint = firstClips[0]?.inPoint || 0;

    let switches: CameraSwitch[] = enforcedSegments.map((seg) => {
      const startSec = frameIndexToSeconds(seg.startFrame, ANALYSIS_CONSTANTS.HOP_SIZE, sampleRate);
      const endSec = frameIndexToSeconds(seg.endFrame, ANALYSIS_CONSTANTS.HOP_SIZE, sampleRate);

      // Map speaker index to video track index
      const speakerIdx = seg.speaker >= 0 && seg.speaker < mappings.length
        ? seg.speaker
        : 0;
      const videoTrackIndex = mappings[speakerIdx].videoTrackIndex;

      return {
        cameraTrackIndex: videoTrackIndex,
        startTimecode: analysisTimeToTimeline(startSec, clipStartTime, clipInPoint, frameRate),
        endTimecode: analysisTimeToTimeline(endSec, clipStartTime, clipInPoint, frameRate),
      };
    });

    // Insert wide shots at configured intervals
    if (settings.wideShotTrackIndex !== null && switches.length > 0) {
      const wideShotInterval = settings.wideShotFrequencySeconds;
      const withWideShots: CameraSwitch[] = [];
      let timeSinceWideShot = 0;

      for (const sw of switches) {
        const duration = sw.endTimecode - sw.startTimecode;
        timeSinceWideShot += duration;

        if (timeSinceWideShot >= wideShotInterval && duration >= settings.minCutDurationSeconds) {
          // Insert wide shot for half the minimum cut duration
          const wideShotDuration = settings.minCutDurationSeconds / 2;
          const wideStart = sw.startTimecode;
          const wideEnd = wideStart + wideShotDuration;

          withWideShots.push({
            cameraTrackIndex: settings.wideShotTrackIndex,
            startTimecode: wideStart,
            endTimecode: wideEnd,
          });
          withWideShots.push({
            cameraTrackIndex: sw.cameraTrackIndex,
            startTimecode: wideEnd,
            endTimecode: sw.endTimecode,
          });
          timeSinceWideShot = 0;
        } else {
          withWideShots.push(sw);
        }
      }
      switches = withWideShots;
    }

    onProgress({ phase: "complete", percent: 100, message: "Analysis complete" });

    const totalCuts = switches.length;
    const totalDuration = switches.length > 0
      ? switches[switches.length - 1].endTimecode - switches[0].startTimecode
      : 0;
    const averageShotDuration = totalCuts > 0 ? totalDuration / totalCuts : 0;

    return {
      switches,
      totalCuts,
      averageShotDuration,
    };
  } finally {
    cleanupTempFiles();
  }
};
