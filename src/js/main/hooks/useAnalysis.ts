import { useState, useCallback } from "react";
import type { AnalysisProgress } from "../../../shared/types";

export const useAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({
    phase: "complete",
    percent: 0,
    message: "",
  });
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    setError(null);
    setProgress({ phase: "extracting", percent: 0, message: "Extracting audio..." });
  }, []);

  const updateProgress = useCallback((update: AnalysisProgress) => {
    setProgress(update);
  }, []);

  const completeAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    setProgress({ phase: "complete", percent: 100, message: "Analysis complete" });
  }, []);

  const failAnalysis = useCallback((message: string) => {
    setIsAnalyzing(false);
    setError(message);
    setProgress({ phase: "error", percent: 0, message });
  }, []);

  return {
    isAnalyzing,
    progress,
    error,
    startAnalysis,
    updateProgress,
    completeAnalysis,
    failAnalysis,
  };
};
