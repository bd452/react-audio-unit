import type { PluginConfig } from "@react-audio-unit/core";

export default {
  name: "{{PLUGIN_NAME}}",
  vendor: "My Company",
  vendorId: "MyCo",
  pluginId: "MyPl",
  version: "1.0.0",
  category: "Effect",
  formats: ["AU", "VST3"],
  channels: {
    input: 2,
    output: 2,
  },
  ui: {
    width: 600,
    height: 400,
    resizable: true,
  },
} satisfies PluginConfig;
