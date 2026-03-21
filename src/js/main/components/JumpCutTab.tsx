import { useState, useCallback } from "react";
import { Slider } from "./Slider";
import { ProgressBar } from "./ProgressBar";
import { StatusMessage } from "./StatusMessage";
import { Preview } from "./Preview";
import { useAnalysis } from "../hooks/useAnalysis";
import { DEFAULT_JUMP_CUT } from "../../../shared/defaults";
import type { JumpCutSettings, JumpCutResult } from "../../../shared/types";
import { analyzeJumpCuts } from "../../engine/jump-cut-engine";
import { evalTS } from "../../lib/utils/bolt";

export const JumpCutTab = () => {
  const [settings, setSettings] = useState<JumpCutSettings>(DEFAULT_JUMP_CUT);
  const [result, setResult] = useState<JumpCutResult | null>(null);
  const [scopeLabel, setScopeLabel] = useState("Ready");
  const analysis = useAnalysis();

  const updateSetting = <K extends keyof JumpCutSettings>(
    key: K,
    value: JumpCutSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleAnalyze = useCallback(async () => {
    analysis.startAnalysis();
    try {
      const analysisResult = await analyzeJumpCuts(
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
      const response = await evalTS(
        "applyJumpCuts",
        JSON.stringify(result.cutList),
      );
      const parsed = response as unknown as {
        error?: string;
        cutsApplied?: number;
      };
      if (parsed.error) throw new Error(parsed.error);
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
          disabled={analysis.isAnalyzing}
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
