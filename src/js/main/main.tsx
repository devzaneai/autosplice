import React, { useEffect, useState, Component } from "react";
import "./main.scss";

// Error boundary to catch and display crashes
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: `${error.name}: ${error.message}\n${error.stack}` };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "16px", color: "#ff6b6b", fontSize: "11px", fontFamily: "monospace", whiteSpace: "pre-wrap", backgroundColor: "#1a1a1a" }}>
          <h2 style={{ color: "#fff", fontSize: "14px", marginBottom: "8px" }}>AutoSplice Error</h2>
          {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load tabs to isolate any import crashes
const JumpCutTab = React.lazy(() =>
  import("./components/JumpCutTab").then((m) => ({ default: m.JumpCutTab }))
);
const MultiCamTab = React.lazy(() =>
  import("./components/MultiCamTab").then((m) => ({ default: m.MultiCamTab }))
);

type TabId = "jumpcut" | "multicam";

export const App = () => {
  const [bgColor, setBgColor] = useState("#232323");
  const [activeTab, setActiveTab] = useState<TabId>("jumpcut");
  const [initStatus, setInitStatus] = useState("Loading...");

  useEffect(() => {
    const init = async () => {
      try {
        if (window.cep) {
          const bolt = await import("../lib/utils/bolt");
          bolt.subscribeBackgroundColor(setBgColor);
          bolt.initBolt();
          setInitStatus("Ready");
        } else {
          setInitStatus("Dev mode (no Premiere)");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setInitStatus(`Init error: ${msg}`);
      }
    };
    init();
  }, []);

  return (
    <ErrorBoundary>
      <div className="app" style={{ backgroundColor: bgColor }}>
        <div className="app-header">
          <h1 className="app-title">AutoSplice</h1>
          <span className="app-version">v1.0.0 | {initStatus}</span>
        </div>

        <div className="tab-bar">
          <button
            className={`tab ${activeTab === "jumpcut" ? "active" : ""}`}
            onClick={() => setActiveTab("jumpcut")}
          >
            Jump Cut
          </button>
          <button
            className={`tab ${activeTab === "multicam" ? "active" : ""}`}
            onClick={() => setActiveTab("multicam")}
          >
            Multi-Cam
          </button>
        </div>

        <React.Suspense fallback={<div style={{ padding: "16px", color: "#888" }}>Loading tab...</div>}>
          {activeTab === "jumpcut" && <JumpCutTab />}
          {activeTab === "multicam" && <MultiCamTab />}
        </React.Suspense>
      </div>
    </ErrorBoundary>
  );
};
