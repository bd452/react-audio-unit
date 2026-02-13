import { describe, it, expect } from "vitest";
import { resolveIOConfig, type PluginConfig, type PluginIOConfig } from "../types.js";

describe("resolveIOConfig", () => {
  it("returns io field when present", () => {
    const io: PluginIOConfig = {
      audio: {
        inputs: [{ name: "Main", layouts: ["stereo"] }],
        outputs: [{ name: "Main", layouts: ["stereo"] }],
      },
      midi: {
        inputs: [{ name: "MIDI In" }],
      },
    };

    const config: PluginConfig = {
      name: "Test",
      vendor: "Test",
      vendorId: "TEST",
      pluginId: "TEST",
      version: "1.0.0",
      category: "Effect",
      formats: ["VST3"],
      io,
      ui: { width: 400, height: 300 },
    };

    expect(resolveIOConfig(config)).toBe(io);
  });

  it("upgrades legacy channels for a stereo effect", () => {
    const config: PluginConfig = {
      name: "Test Effect",
      vendor: "Test",
      vendorId: "TEST",
      pluginId: "TEST",
      version: "1.0.0",
      category: "Effect",
      formats: ["VST3"],
      channels: { input: 2, output: 2 },
      ui: { width: 400, height: 300 },
    };

    const result = resolveIOConfig(config);
    expect(result.audio.inputs).toHaveLength(1);
    expect(result.audio.inputs[0].name).toBe("Main");
    expect(result.audio.inputs[0].layouts[0]).toBe("stereo");
    expect(result.audio.outputs).toHaveLength(1);
    expect(result.audio.outputs[0].layouts[0]).toBe("stereo");
    // Effects don't get automatic MIDI
    expect(result.midi).toBeUndefined();
  });

  it("upgrades legacy channels for an instrument (no input, MIDI auto-added)", () => {
    const config: PluginConfig = {
      name: "Test Synth",
      vendor: "Test",
      vendorId: "TEST",
      pluginId: "TEST",
      version: "1.0.0",
      category: "Instrument",
      formats: ["VST3"],
      channels: { input: 0, output: 2 },
      ui: { width: 400, height: 300 },
    };

    const result = resolveIOConfig(config);
    expect(result.audio.inputs).toHaveLength(0);
    expect(result.audio.outputs).toHaveLength(1);
    expect(result.audio.outputs[0].layouts[0]).toBe("stereo");
    // Instruments get automatic MIDI input
    expect(result.midi).toBeDefined();
    expect(result.midi!.inputs).toHaveLength(1);
    expect(result.midi!.inputs![0].name).toBe("MIDI In");
  });

  it("defaults to stereo in/out for effect with no channels or io", () => {
    const config: PluginConfig = {
      name: "Test",
      vendor: "Test",
      vendorId: "TEST",
      pluginId: "TEST",
      version: "1.0.0",
      category: "Effect",
      formats: ["VST3"],
      ui: { width: 400, height: 300 },
    };

    const result = resolveIOConfig(config);
    expect(result.audio.inputs).toHaveLength(1);
    expect(result.audio.inputs[0].layouts[0]).toBe("stereo");
    expect(result.audio.outputs[0].layouts[0]).toBe("stereo");
  });

  it("upgrades mono channel count correctly", () => {
    const config: PluginConfig = {
      name: "Mono Effect",
      vendor: "Test",
      vendorId: "TEST",
      pluginId: "TEST",
      version: "1.0.0",
      category: "Effect",
      formats: ["VST3"],
      channels: { input: 1, output: 1 },
      ui: { width: 400, height: 300 },
    };

    const result = resolveIOConfig(config);
    expect(result.audio.inputs[0].layouts[0]).toBe("mono");
    expect(result.audio.outputs[0].layouts[0]).toBe("mono");
  });

  it("upgrades 5.1 channel count correctly", () => {
    const config: PluginConfig = {
      name: "Surround Effect",
      vendor: "Test",
      vendorId: "TEST",
      pluginId: "TEST",
      version: "1.0.0",
      category: "Effect",
      formats: ["VST3"],
      channels: { input: 6, output: 6 },
      ui: { width: 400, height: 300 },
    };

    const result = resolveIOConfig(config);
    expect(result.audio.inputs[0].layouts[0]).toBe("surround-5.1");
    expect(result.audio.outputs[0].layouts[0]).toBe("surround-5.1");
  });
});
