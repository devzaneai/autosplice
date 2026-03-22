import { useState, useCallback, useEffect } from "react";
import { Slider } from "./Slider";
import { ProgressBar } from "./ProgressBar";
import { StatusMessage } from "./StatusMessage";
import { Preview } from "./Preview";
import { SpeakerMap } from "./SpeakerMap";
import { useAnalysis } from "../hooks/useAnalysis";
import { DEFAULT_MULTI_CAM } from "../../../shared/defaults";
import type { MultiCamSettings, MultiCamResult, SpeakerMapping } from "../../../shared/types";

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
  const [audioTrackNames, setAudioTrackNames] = useState<string[]>([]);
  const [videoTrackNames, setVideoTrackNames] = useState<string[]>([]);
  const [statusLabel, setStatusLabel] = useState("Loading tracks...");
  const analysis = useAnalysis();

  // Load track names from Premiere on mount
  useEffect(() => {
    if (!window.cep) return;

    const loadTracks = async () => {
      try {
        const evalTS = await getEvalTS();
        const trackNames = (await evalTS("getTrackNames")) as unknown as {
          audio: string[];
          video: string[];
        };
        if (trackNames.audio) setAudioTrackNames(trackNames.audio);
        if (trackNames.video) setVideoTrackNames(trackNames.video);
        setStatusLabel("Set up speaker mappings below, then click Analyze");
      } catch {
        setStatusLabel("Open a sequence to configure multi-cam");
      }
    };

    const delay = setTimeout(loadTracks, 2000);
    return () => clearTimeout(delay);
  }, []);

  const updateSetting = <K extends keyof MultiCamSettings>(
    key: K,
    value: MultiCamSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleAnalyze = useCallback(async () => {
    if (settings.speakerMappings.length < 2) {
      analysis.failAnalysis("Add at least 2 speaker mappings (audio → video track pairs)");
      return;
    }

    analysis.startAnalysis();
    setStatusLabel("Analyzing audio tracks...");
    try {
      // Refresh track names
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
      setStatusLabel(`Found ${analysisResult.totalCuts} camera switches (avg ${analysisResult.averageShotDuration.toFixed(1)}s per shot)`);
      analysis.completeAnalysis();
    } catch (err: unknown) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as any).message);
      } else {
        message = String(err);
      }
      setStatusLabel(`Error: ${message}`);
      analysis.failAnalysis(message);
    }
  }, [settings, analysis]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    try {
      const evalTS = await getEvalTS();
      // Pass switches as JSON string — evalTS will handle serialization
      const response = await evalTS(
        "applyMultiCamSwitches",
        JSON.stringify(result.switches),
      );
      const parsed = response as any;
      if (parsed.error) throw new Error(parsed.error);
      setStatusLabel(`Applied ${parsed.switchesApplied} camera switches`);
      analysis.updateProgress({
        phase: "complete",
        percent: 100,
        message: `Applied ${parsed.switchesApplied} camera switches`,
      });
    } catch (err: unknown) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as any).message);
      } else {
        message = String(err);
      }
      setStatusLabel(`Error: ${message}`);
      analysis.failAnalysis(message);
    }
  }, [result, analysis]);

  const previewSegments = result
    ? result.switches.map((sw) => ({
        start: sw.startTimecode,
        end: sw.endTimecode,
        type: "camera" as const,
        color: CAMERA_COLORS[sw.cameraTrackIndex % CAMERA_COLORS.length],
        label: videoTrackNames[sw.cameraTrackIndex] || `V${sw.cameraTrackIndex + 1}`,
      }))
    : [];

  return (
    <div className="tab-content">
      <div className="scope-indicator">{statusLabel}</div>

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
          tooltip="Minimum time on one camera before switching"
          onChange={(v) => updateSetting("minCutDurationSeconds", v)}
        />
        <Slider
          label="Crosstalk Sensitivity"
          value={settings.crosstalkSensitivityDb}
          min={2} max={15} step={1} unit=" dB"
          tooltip="How much louder a mic must be to trigger a switch. Higher = more conservative."
          onChange={(v) => updateSetting("crosstalkSensitivityDb", v)}
        />
        <Slider
          label="Wide Shot Frequency"
          value={settings.wideShotFrequencySeconds}
          min={10} max={120} step={5} unit="s"
          tooltip="How often to cut to the wide shot camera"
          onChange={(v) => updateSetting("wideShotFrequencySeconds", v)}
        />

        {videoTrackNames.length > 2 && (
          <div className="mode-selector">
            <label>Wide Shot Track:</label>
            <select
              value={settings.wideShotTrackIndex ?? ""}
              onChange={(e) => updateSetting("wideShotTrackIndex", e.target.value === "" ? null : Number(e.target.value))}
              style={{ padding: "4px 6px", background: "#333", border: "1px solid #444", borderRadius: "4px", color: "#e0e0e0", fontSize: "11px" }}
            >
              <option value="">None</option>
              {videoTrackNames.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>
        )}
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
