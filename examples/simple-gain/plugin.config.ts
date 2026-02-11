import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Simple Gain",
  vendor: "RAU Examples",
  vendorId: "RAUx",
  pluginId: "SmGn",
  version: "1.0.0",
  category: "Effect",
  formats: ["AU", "VST3"],
  channels: {
    input: 2,
    output: 2,
  },
  ui: {
    width: 300,
    height: 250,
    resizable: false,
  },
} satisfies PluginConfig;
