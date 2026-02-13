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
      main: [{ input: "disabled", output: "stereo" }],
    },
    midi: {
      input: true,
      output: false,
    },
  },
  ui: {
    width: 700,
    height: 500,
    resizable: true,
  },
} satisfies PluginConfig;
