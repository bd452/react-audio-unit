import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Channel Strip",
  vendor: "RAU Examples",
  vendorId: "RAUx",
  pluginId: "ChSt",
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
    width: 800,
    height: 450,
    resizable: true,
  },
} satisfies PluginConfig;
