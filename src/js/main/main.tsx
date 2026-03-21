import { useEffect, useState } from "react";
import { subscribeBackgroundColor } from "../lib/utils/bolt";
import "./main.scss";

export const App = () => {
  const [bgColor, setBgColor] = useState("#232323");

  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
  }, []);

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      <h1>AutoSplice v1.0.0</h1>
      <p>Loading...</p>
    </div>
  );
};
