import React from "react";
import ReactDOM from "react-dom/client";
import "../index.scss";
import { App } from "./main";

// NOTE: initBolt() is called inside App's useEffect, not here.
// Calling it at module level crashes the panel if ExtendScript isn't ready.

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
