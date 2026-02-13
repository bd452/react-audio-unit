import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Echo Delay",
  vendor: "React Audio Unit",
  vendorId: "RAUn",
  pluginId: "EcDl",
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
    width: 500,
    height: 340,
    resizable: false,
  },
} satisfies PluginConfig;
