import React from "react";
import ReactDOM from "react-dom/client";
import { PluginHost } from "@react-audio-unit/core";
import "@react-audio-unit/ui/themes/dark.css";
import EchoDelay from "./EchoDelay.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PluginHost>
      <EchoDelay />
    </PluginHost>
  </React.StrictMode>,
);
