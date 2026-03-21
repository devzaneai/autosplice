import { useEffect, useState } from "react";
import { initBolt, subscribeBackgroundColor } from "../lib/utils/bolt";
import { JumpCutTab } from "./components/JumpCutTab";
import { MultiCamTab } from "./components/MultiCamTab";
import "./main.scss";

type TabId = "jumpcut" | "multicam";

export const App = () => {
  const [bgColor, setBgColor] = useState("#232323");
  const [activeTab, setActiveTab] = useState<TabId>("jumpcut");

  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
      initBolt();
    }
  }, []);

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      <div className="app-header">
        <h1 className="app-title">AutoSplice</h1>
        <span className="app-version">v1.0.0</span>
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

      {activeTab === "jumpcut" && <JumpCutTab />}
      {activeTab === "multicam" && <MultiCamTab />}
    </div>
  );
};
