import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "{{PLUGIN_NAME}}",
  vendor: "My Company",
  vendorId: "MyCo",
  pluginId: "MyPl",
  version: "1.0.0",
  category: "Effect",
  formats: ["AU", "VST3"],
  io: {
    audio: {
      inputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
      outputs: [{ name: "Main", layouts: ["stereo"] }],
    },
  },
  ui: {
    width: 600,
    height: 400,
    resizable: true,
  },
} satisfies PluginConfig;
