import { useState, useCallback } from "react";
import { Slider } from "./Slider";
import { ProgressBar } from "./ProgressBar";
import { StatusMessage } from "./StatusMessage";
import { Preview } from "./Preview";
import { SpeakerMap } from "./SpeakerMap";
import { useAnalysis } from "../hooks/useAnalysis";
import { DEFAULT_MULTI_CAM } from "../../../shared/defaults";
import type { MultiCamSettings, MultiCamResult } from "../../../shared/types";

const getEvalTS = async () => {
  const bolt = await import("../../lib/utils/bolt");
  return bolt.evalTS;
};

const CAMERA_COLORS = [
  "#4a9eff", "#ff6b6b", "#51cf66", "#ffd43b",
  "#cc5de8", "#ff922b", "#20c997", "#f06595",
  "#868e96", "#339af0",
];

export const MultiCamTab = () => {
  const [settings, setSettings] = useState<MultiCamSettings>(DEFAULT_MULTI_CAM);
  const [result, setResult] = useState<MultiCamResult | null>(null);
  const [audioTrackNames, setAudioTrackNames] = useState<string[]>(["A1", "A2", "A3"]);
  const [videoTrackNames, setVideoTrackNames] = useState<string[]>(["V1", "V2", "V3"]);
  const analysis = useAnalysis();

  const updateSetting = <K extends keyof MultiCamSettings>(
    key: K,
    value: MultiCamSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleAnalyze = useCallback(async () => {
    analysis.startAnalysis();
    try {
      const evalTS = await getEvalTS();
      const trackNames = (await evalTS("getTrackNames")) as unknown as {
        audio: string[];
        video: string[];
      };
      if (trackNames.audio) setAudioTrackNames(trackNames.audio);
      if (trackNames.video) setVideoTrackNames(trackNames.video);

      const { analyzeMultiCam } = await import("../../engine/multi-cam-engine");
      const analysisResult = await analyzeMultiCam(
        settings,
        analysis.updateProgress,
      );
      setResult(analysisResult);
      analysis.completeAnalysis();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      analysis.failAnalysis(message);
    }
  }, [settings, analysis]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    try {
      const evalTS = await getEvalTS();
      const response = await evalTS(
        "applyMultiCamSwitches",
        JSON.stringify(result.switches),
      );
      const parsed = response as unknown as {
        error?: string;
        switchesApplied?: number;
      };
      if (parsed.error) throw new Error(parsed.error);
      analysis.updateProgress({
        phase: "complete",
        percent: 100,
        message: `Applied ${parsed.switchesApplied} camera switches`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Apply failed";
      analysis.failAnalysis(message);
    }
  }, [result, analysis]);

  const previewSegments = result
    ? result.switches.map((sw) => ({
        start: sw.startTimecode,
        end: sw.endTimecode,
        type: "camera" as const,
        color: CAMERA_COLORS[sw.cameraTrackIndex % CAMERA_COLORS.length],
        label: `V${sw.cameraTrackIndex + 1}`,
      }))
    : [];

  return (
    <div className="tab-content">
      <SpeakerMap
        mappings={settings.speakerMappings}
        audioTrackNames={audioTrackNames}
        videoTrackNames={videoTrackNames}
        onChange={(mappings) => updateSetting("speakerMappings", mappings)}
      />

      <div className="settings-section">
        <Slider
          label="Min Cut Duration"
          value={settings.minCutDurationSeconds}
          min={1} max={10} step={0.5} unit="s"
          tooltip="Minimum time before switching cameras"
          onChange={(v) => updateSetting("minCutDurationSeconds", v)}
        />
        <Slider
          label="Crosstalk Sensitivity"
          value={settings.crosstalkSensitivityDb}
          min={2} max={15} step={1} unit=" dB"
          tooltip="Required loudness differential to confirm active speaker"
          onChange={(v) => updateSetting("crosstalkSensitivityDb", v)}
        />
        <Slider
          label="Wide Shot Frequency"
          value={settings.wideShotFrequencySeconds}
          min={10} max={120} step={5} unit="s"
          tooltip="How often to insert a wide/group shot"
          onChange={(v) => updateSetting("wideShotFrequencySeconds", v)}
        />
      </div>

      {result && (
        <Preview
          segments={previewSegments}
          totalDuration={
            result.switches.length > 0
              ? result.switches[result.switches.length - 1].endTimecode
              : 0
          }
          stats={`${result.totalCuts} cuts \u00b7 avg ${result.averageShotDuration.toFixed(1)}s per shot`}
        />
      )}

      <div className="button-group">
        <button onClick={handleAnalyze} disabled={analysis.isAnalyzing} className="btn-primary">
          Analyze
        </button>
        <button onClick={handleApply} disabled={!result || analysis.isAnalyzing} className="btn-apply">
          Apply
        </button>
      </div>

      <ProgressBar percent={analysis.progress.percent} message={analysis.progress.message} visible={analysis.isAnalyzing} />
      <StatusMessage message={analysis.error} type="error" />
    </div>
  );
};
