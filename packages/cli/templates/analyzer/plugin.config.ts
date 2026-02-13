import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "{{PLUGIN_NAME}}",
  vendor: "My Company",
  vendorId: "MyCo",
  pluginId: "MyAn",
  version: "1.0.0",
  category: "Analyzer",
  formats: ["AU", "VST3"],
  io: {
    audio: {
      inputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
      outputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
    },
  },
  ui: {
    width: 800,
    height: 500,
    resizable: true,
  },
} satisfies PluginConfig;
