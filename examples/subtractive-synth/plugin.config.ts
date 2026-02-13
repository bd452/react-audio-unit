import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Subtractive Synth",
  vendor: "RAU Examples",
  vendorId: "RAUx",
  pluginId: "SbSy",
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
    width: 750,
    height: 500,
    resizable: true,
  },
} satisfies PluginConfig;
