import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Simple Gain",
  vendor: "RAU Examples",
  vendorId: "RAUx",
  pluginId: "SmGn",
  version: "1.0.0",
  category: "Effect",
  formats: ["AU", "VST3"],
  io: {
    audio: {
      main: [
        { input: "mono", output: "mono" },
        { input: "stereo", output: "stereo" },
      ],
    },
    midi: {
      input: false,
      output: false,
    },
  },
  ui: {
    width: 300,
    height: 250,
    resizable: false,
  },
} satisfies PluginConfig;
