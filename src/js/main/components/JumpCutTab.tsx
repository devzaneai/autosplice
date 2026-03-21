import { useState, useCallback, useEffect } from "react";
import { Slider } from "./Slider";
import { ProgressBar } from "./ProgressBar";
import { StatusMessage } from "./StatusMessage";
import { Preview } from "./Preview";
import { useAnalysis } from "../hooks/useAnalysis";
import { DEFAULT_JUMP_CUT } from "../../../shared/defaults";
import type { JumpCutSettings, JumpCutResult } from "../../../shared/types";

const getEvalTS = async () => {
  const bolt = await import("../../lib/utils/bolt");
  return bolt.evalTS;
};

export const JumpCutTab = () => {
  const [settings, setSettings] = useState<JumpCutSettings>(DEFAULT_JUMP_CUT);
  const [result, setResult] = useState<JumpCutResult | null>(null);
  const [scopeLabel, setScopeLabel] = useState(
    "Ready — click Analyze to start",
  );
  const [hasSequence, setHasSequence] = useState(true);
  const analysis = useAnalysis();

  useEffect(() => {
    if (!window.cep) return;

    let cancelled = false;

    const checkSequence = async () => {
      try {
        const evalTS = await getEvalTS();
        const info = await evalTS("getSequenceInfo");
        if (cancelled) return;
        const seqInfo = info as any;
        if (seqInfo && !seqInfo.error) {
          setHasSequence(true);
          if (seqInfo.selectedClips && seqInfo.selectedClips.length > 0) {
            setScopeLabel(
              `${seqInfo.selectedClips.length} selected clip(s) in "${seqInfo.name}"`,
            );
          } else if (seqInfo.inPoint !== null && seqInfo.outPoint !== null) {
            setScopeLabel(`In/Out range in "${seqInfo.name}"`);
          } else {
            setScopeLabel(`Full sequence: "${seqInfo.name}" (Track A1)`);
          }
        } else {
          setHasSequence(false);
          setScopeLabel("No active sequence — open a sequence first");
        }
      } catch {
        if (!cancelled) {
          setScopeLabel("Ready — click Analyze to start");
          setHasSequence(true);
        }
      }
    };

    const initialDelay = setTimeout(checkSequence, 2000);
    const interval = setInterval(checkSequence, 3000);
    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  const updateSetting = <K extends keyof JumpCutSettings>(
    key: K,
    value: JumpCutSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleAnalyze = useCallback(async () => {
    analysis.startAnalysis();
    try {
      // Step 1: Get sequence info from Premiere
      setScopeLabel("Step 1: Getting sequence info...");
      const evalTS = await getEvalTS();
      const seqInfo = (await evalTS("getSequenceInfo")) as any;
      if (!seqInfo || seqInfo.error) {
        throw new Error(seqInfo?.error || "No active sequence found");
      }
      setScopeLabel(
        `Step 1 OK: "${seqInfo.name}" (${seqInfo.audioTrackCount} audio tracks)`,
      );

      // Step 2: Get clips
      let clips: any[];
      if (seqInfo.selectedClips && seqInfo.selectedClips.length > 0) {
        clips = seqInfo.selectedClips;
      } else {
        clips = (await evalTS("getAudioTrackClips", 0)) as any;
      }
      if (!clips || clips.length === 0) {
        throw new Error(
          "No clips found on the timeline. Add clips to a sequence first.",
        );
      }
      setScopeLabel(
        `Step 2 OK: Found ${clips.length} clip(s), media: ${clips[0].mediaPath}`,
      );

      // Step 3: Extract audio via FFmpeg
      analysis.updateProgress({
        phase: "extracting",
        percent: 20,
        message: "Extracting audio...",
      });
      setScopeLabel("Step 3: Extracting audio with FFmpeg...");
      const { extractAudio, cleanupTempFiles } = await import(
        "../../engine/ffmpeg-bridge"
      );
      const wavPath = await extractAudio(
        clips[0].mediaPath,
        "jumpcut-analysis",
        true,
      );
      setScopeLabel(`Step 3 OK: WAV at ${wavPath}`);

      // Step 4: Read WAV and analyze
      analysis.updateProgress({
        phase: "analyzing",
        percent: 40,
        message: "Analyzing audio...",
      });
      setScopeLabel("Step 4: Reading WAV and analyzing frames...");
      const { fs } = await import("../../lib/cep/node");
      const { readWav } = await import("../../engine/wav-reader");
      const { analyzeFrames } = await import("../../engine/analyzer");
      const { ANALYSIS_CONSTANTS } = await import("../../../shared/defaults");

      const wavBuffer = fs.readFileSync(wavPath);
      const wavData = readWav(wavBuffer);
      const frameData = analyzeFrames(
        wavData.samples,
        wavData.sampleRate,
        ANALYSIS_CONSTANTS.FRAME_LENGTH,
        ANALYSIS_CONSTANTS.HOP_SIZE,
      );
      setScopeLabel(
        `Step 4 OK: ${frameData.totalFrames} frames, ${wavData.duration.toFixed(1)}s`,
      );

      // Step 5: Detect silence
      analysis.updateProgress({
        phase: "detecting",
        percent: 65,
        message: "Detecting silence...",
      });
      setScopeLabel("Step 5: Detecting silence regions...");
      const { detectSilence, filterByDuration, applyPadding } = await import(
        "../../engine/silence-detector"
      );

      let silenceRegions = detectSilence(
        frameData.rmsValues,
        settings.silenceThresholdDb,
        ANALYSIS_CONSTANTS.HOP_SIZE,
        wavData.sampleRate,
      );
      silenceRegions = filterByDuration(
        silenceRegions,
        settings.minSilenceDurationMs,
      );
      silenceRegions = applyPadding(
        silenceRegions,
        settings.paddingMs,
        frameData.durationSeconds,
      );

      // Step 6: Generate cut list
      const { analysisTimeToTimeline } = await import(
        "../../engine/time-mapper"
      );
      const frameRate = seqInfo.frameRate || 30;
      const cutList = silenceRegions.map((region: any) => ({
        startTimecode: analysisTimeToTimeline(
          region.startSeconds,
          clips[0].startTime,
          clips[0].inPoint,
          frameRate,
        ),
        endTimecode: analysisTimeToTimeline(
          region.endSeconds,
          clips[0].startTime,
          clips[0].inPoint,
          frameRate,
        ),
        action: settings.mode,
      }));

      const totalDuration = frameData.durationSeconds;
      const silenceDuration = silenceRegions.reduce(
        (sum: number, r: any) => sum + (r.endSeconds - r.startSeconds),
        0,
      );

      const analysisResult = {
        cutList,
        totalDuration,
        keptDuration: totalDuration - silenceDuration,
        silenceCount: cutList.length,
      };

      setResult(analysisResult);
      setScopeLabel(
        `Found ${cutList.length} silence regions. Keeping ${Math.round((analysisResult.keptDuration / totalDuration) * 100)}% of audio.`,
      );
      analysis.completeAnalysis();
      cleanupTempFiles();
    } catch (err: unknown) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as any).message);
        if ("fileName" in err) message += ` (file: ${(err as any).fileName})`;
        if ("line" in err) message += ` (line: ${(err as any).line})`;
      } else {
        message = JSON.stringify(err);
      }
      setScopeLabel(`ERROR: ${message}`);
      analysis.failAnalysis(message);
    }
  }, [settings, analysis]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    try {
      const evalTS = await getEvalTS();
      const response = await evalTS(
        "applyJumpCuts",
        JSON.stringify(result.cutList),
      );
      const parsed = response as unknown as {
        error?: string;
        cutsApplied?: number;
        videoRemoved?: number;
        videoKept?: number;
        audioRemoved?: number;
        audioKept?: number;
      };
      if (parsed.error) throw new Error(parsed.error);
      const detail = `V: ${parsed.videoRemoved} removed, ${parsed.videoKept} kept | A: ${parsed.audioRemoved} removed, ${parsed.audioKept} kept`;
      setScopeLabel(`Applied ${parsed.cutsApplied} cuts. ${detail}`);
      analysis.updateProgress({
        phase: "complete",
        percent: 100,
        message: `Applied ${parsed.cutsApplied} cuts`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Apply failed";
      analysis.failAnalysis(message);
    }
  }, [result, analysis]);

  const previewSegments = result
    ? result.cutList.map((cut) => ({
        start: cut.startTimecode,
        end: cut.endTimecode,
        type: "cut" as const,
      }))
    : [];

  return (
    <div className="tab-content">
      <div className="scope-indicator">{scopeLabel}</div>

      <div className="settings-section">
        <Slider
          label="Silence Threshold"
          value={settings.silenceThresholdDb}
          min={-60}
          max={-20}
          step={1}
          unit=" dB"
          tooltip="Audio below this level is considered silence"
          onChange={(v) => updateSetting("silenceThresholdDb", v)}
        />
        <Slider
          label="Min Silence Duration"
          value={settings.minSilenceDurationMs}
          min={100}
          max={2000}
          step={50}
          unit=" ms"
          tooltip="Silence must last this long to be cut"
          onChange={(v) => updateSetting("minSilenceDurationMs", v)}
        />
        <Slider
          label="Padding"
          value={settings.paddingMs}
          min={0}
          max={500}
          step={10}
          unit=" ms"
          tooltip="Buffer kept before/after speech to avoid clipping words"
          onChange={(v) => updateSetting("paddingMs", v)}
        />
        <div className="mode-selector">
          <label>Mode:</label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={settings.mode === "delete"}
              onChange={() => updateSetting("mode", "delete")}
            />
            Delete
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={settings.mode === "disable"}
              onChange={() => updateSetting("mode", "disable")}
            />
            Disable
          </label>
        </div>
      </div>

      {result && (
        <Preview
          segments={previewSegments}
          totalDuration={result.totalDuration}
          stats={`Keeping: ${formatTime(result.keptDuration)} / ${formatTime(result.totalDuration)} (${Math.round((result.keptDuration / result.totalDuration) * 100)}%)`}
        />
      )}

      <div className="button-group">
        <button
          onClick={handleAnalyze}
          disabled={analysis.isAnalyzing || !hasSequence}
          className="btn-primary"
        >
          Analyze
        </button>
        <button
          onClick={handleApply}
          disabled={!result || analysis.isAnalyzing}
          className="btn-apply"
        >
          Apply
        </button>
      </div>

      <ProgressBar
        percent={analysis.progress.percent}
        message={analysis.progress.message}
        visible={analysis.isAnalyzing}
      />

      <StatusMessage message={analysis.error} type="error" />
    </div>
  );
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};
