import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "{{PLUGIN_NAME}}",
  vendor: "My Company",
  vendorId: "MyCo",
  pluginId: "MySy",
  version: "1.0.0",
  category: "Instrument",
  formats: ["AU", "VST3"],
  io: {
    audio: {
      inputs: [],
      outputs: [{ name: "Main", layouts: ["stereo"] }],
    },
    midi: {
      inputs: [{ name: "MIDI In" }],
    },
  },
  ui: {
    width: 700,
    height: 500,
    resizable: true,
  },
} satisfies PluginConfig;
