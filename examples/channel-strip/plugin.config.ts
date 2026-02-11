import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "Channel Strip",
  vendor: "RAU Examples",
  vendorId: "RAUx",
  pluginId: "ChSt",
  version: "1.0.0",
  category: "Effect",
  formats: ["AU", "VST3"],
  channels: {
    input: 2,
    output: 2,
  },
  ui: {
    width: 800,
    height: 450,
    resizable: true,
  },
} satisfies PluginConfig;
