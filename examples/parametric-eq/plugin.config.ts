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
      inputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
      outputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
    },
  },
  ui: {
    width: 700,
    height: 450,
    resizable: true,
  },
} satisfies PluginConfig;
