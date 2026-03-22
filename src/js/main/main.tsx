import { useEffect, useState } from "react";
import { JumpCutTab } from "./components/JumpCutTab";
import { MultiCamTab } from "./components/MultiCamTab";
import "./main.scss";

type TabId = "jumpcut" | "multicam" | "fulledit" | "fillers";

const FullEditTab = () => (
  <div className="tab-content">
    <div className="scope-indicator">Full Edit — coming soon</div>
  </div>
);
const FillerTab = () => (
  <div className="tab-content">
    <div className="scope-indicator">Fillers — coming soon</div>
  </div>
);

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
        <button
          className={`tab ${activeTab === "fulledit" ? "active" : ""}`}
          onClick={() => setActiveTab("fulledit")}
        >
          Full Edit
        </button>
        <button
          className={`tab ${activeTab === "fillers" ? "active" : ""}`}
          onClick={() => setActiveTab("fillers")}
        >
          Fillers
        </button>
      </div>

      {activeTab === "jumpcut" && <JumpCutTab />}
      {activeTab === "multicam" && <MultiCamTab />}
      {activeTab === "fulledit" && <FullEditTab />}
      {activeTab === "fillers" && <FillerTab />}
    </div>
  );
};
