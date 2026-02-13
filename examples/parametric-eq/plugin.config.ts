import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Parametric EQ",
  vendor: "RAU Examples",
  vendorId: "RAUx",
  pluginId: "PmEQ",
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
    width: 700,
    height: 450,
    resizable: true,
  },
} satisfies PluginConfig;
