import { describe, it, expect } from "vitest";
import {
  negotiateBusLayout,
  negotiateIOConfig,
  findCommonLayouts,
  busSupportsLayout,
  defaultActiveConfig,
} from "../io-negotiation.js";
import type { AudioBusConfig, PluginIOConfig } from "../types.js";

// ---------------------------------------------------------------------------
// negotiateBusLayout
// ---------------------------------------------------------------------------

describe("negotiateBusLayout", () => {
  it("selects plugin's most-preferred layout when host has no preference", () => {
    const bus: AudioBusConfig = {
      name: "Main",
      layouts: ["surround-5.1", "stereo", "mono"],
    };
    const result = negotiateBusLayout(bus);
    expect(result.matched).toBe(true);
    expect(result.layout).toBe("surround-5.1");
    expect(result.name).toBe("Main");
    expect(result.active).toBe(true);
  });

  it("selects first mutual match between plugin and host", () => {
    const bus: AudioBusConfig = {
      name: "Main",
      layouts: ["surround-5.1", "stereo", "mono"],
    };
    // Host only supports stereo and mono
    const result = negotiateBusLayout(bus, ["stereo", "mono"]);
    expect(result.matched).toBe(true);
    expect(result.layout).toBe("stereo"); // first plugin layout that host supports
  });

  it("prefers plugin order over host order", () => {
    const bus: AudioBusConfig = {
      name: "Main",
      layouts: ["mono", "stereo"], // plugin prefers mono
    };
    const result = negotiateBusLayout(bus, ["stereo", "mono"]); // host prefers stereo
    expect(result.matched).toBe(true);
    expect(result.layout).toBe("mono"); // plugin's preference wins
  });

  it("counter-proposes plugin's preferred when no match", () => {
    const bus: AudioBusConfig = {
      name: "Main",
      layouts: ["surround-7.1"],
    };
    const result = negotiateBusLayout(bus, ["stereo"]);
    expect(result.matched).toBe(false);
    expect(result.layout).toBe("surround-7.1"); // counter-proposal
  });

  it("handles empty host preference array like no preference", () => {
    const bus: AudioBusConfig = {
      name: "Main",
      layouts: ["stereo"],
    };
    const result = negotiateBusLayout(bus, []);
    expect(result.matched).toBe(true);
    expect(result.layout).toBe("stereo");
  });
});

// ---------------------------------------------------------------------------
// negotiateIOConfig
// ---------------------------------------------------------------------------

describe("negotiateIOConfig", () => {
  const stereoEffect: PluginIOConfig = {
    audio: {
      inputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
      outputs: [{ name: "Main", layouts: ["stereo"] }],
    },
  };

  it("succeeds with no host proposal (defaults)", () => {
    const result = negotiateIOConfig(stereoEffect);
    expect(result.success).toBe(true);
    expect(result.config.audio.inputs).toHaveLength(1);
    expect(result.config.audio.inputs[0].layout).toBe("stereo");
    expect(result.config.audio.outputs[0].layout).toBe("stereo");
  });

  it("succeeds when host proposes compatible layouts", () => {
    const result = negotiateIOConfig(stereoEffect, {
      audioInputs: [["mono"]],
      audioOutputs: [["stereo"]],
    });
    expect(result.success).toBe(true);
    expect(result.config.audio.inputs[0].layout).toBe("mono"); // matched
    expect(result.config.audio.outputs[0].layout).toBe("stereo");
  });

  it("fails when required bus cannot match", () => {
    const result = negotiateIOConfig(stereoEffect, {
      audioInputs: [["surround-7.1"]], // plugin doesn't support 7.1 input
    });
    expect(result.success).toBe(false);
    // Counter-proposes plugin's preferred layout
    expect(result.config.audio.inputs[0].layout).toBe("stereo");
  });

  it("succeeds even if optional bus doesn't match", () => {
    const withSidechain: PluginIOConfig = {
      audio: {
        inputs: [
          { name: "Main", layouts: ["stereo"] },
          { name: "Sidechain", layouts: ["mono"], optional: true },
        ],
        outputs: [{ name: "Main", layouts: ["stereo"] }],
      },
    };

    const result = negotiateIOConfig(withSidechain, {
      audioInputs: [["stereo"], ["surround-5.1"]], // sidechain doesn't match
    });
    expect(result.success).toBe(true); // optional bus failure doesn't cause overall failure
    expect(result.config.audio.inputs[0].active).toBe(true);
    expect(result.config.audio.inputs[1].active).toBe(false); // deactivated
  });

  it("resolves MIDI buses with default channel count", () => {
    const synth: PluginIOConfig = {
      audio: {
        inputs: [],
        outputs: [{ name: "Main", layouts: ["stereo"] }],
      },
      midi: {
        inputs: [{ name: "MIDI In" }, { name: "MPE", channels: 16 }],
      },
    };

    const result = negotiateIOConfig(synth);
    expect(result.config.midi.inputs).toHaveLength(2);
    expect(result.config.midi.inputs[0].channels).toBe(16); // default
    expect(result.config.midi.inputs[0].name).toBe("MIDI In");
    expect(result.config.midi.inputs[1].channels).toBe(16);
    expect(result.config.midi.outputs).toHaveLength(0);
  });

  it("handles instrument with no audio inputs", () => {
    const instrument: PluginIOConfig = {
      audio: {
        inputs: [],
        outputs: [{ name: "Main", layouts: ["stereo"] }],
      },
      midi: {
        inputs: [{ name: "MIDI In" }],
      },
    };

    const result = negotiateIOConfig(instrument);
    expect(result.success).toBe(true);
    expect(result.config.audio.inputs).toHaveLength(0);
    expect(result.config.audio.outputs).toHaveLength(1);
    expect(result.config.midi.inputs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// findCommonLayouts
// ---------------------------------------------------------------------------

describe("findCommonLayouts", () => {
  it("finds mutual layouts between two bus configs", () => {
    const a: AudioBusConfig = {
      name: "A",
      layouts: ["surround-5.1", "stereo", "mono"],
    };
    const b: AudioBusConfig = {
      name: "B",
      layouts: ["mono", "stereo", "surround-7.1"],
    };
    const common = findCommonLayouts(a, b);
    expect(common).toEqual(["stereo", "mono"]); // in A's preference order
  });

  it("returns empty array when no common layouts", () => {
    const a: AudioBusConfig = {
      name: "A",
      layouts: ["surround-7.1.4"],
    };
    const b: AudioBusConfig = {
      name: "B",
      layouts: ["mono"],
    };
    expect(findCommonLayouts(a, b)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// busSupportsLayout
// ---------------------------------------------------------------------------

describe("busSupportsLayout", () => {
  const bus: AudioBusConfig = {
    name: "Main",
    layouts: ["stereo", "mono", "surround-5.1"],
  };

  it("returns true for supported layout", () => {
    expect(busSupportsLayout(bus, "stereo")).toBe(true);
    expect(busSupportsLayout(bus, "mono")).toBe(true);
    expect(busSupportsLayout(bus, "surround-5.1")).toBe(true);
  });

  it("returns false for unsupported layout", () => {
    expect(busSupportsLayout(bus, "surround-7.1")).toBe(false);
    expect(busSupportsLayout(bus, "quad")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defaultActiveConfig
// ---------------------------------------------------------------------------

describe("defaultActiveConfig", () => {
  it("selects most-preferred layout for each bus", () => {
    const io: PluginIOConfig = {
      audio: {
        inputs: [{ name: "Main", layouts: ["surround-5.1", "stereo"] }],
        outputs: [{ name: "Main", layouts: ["stereo", "mono"] }],
      },
      midi: {
        inputs: [{ name: "MIDI In" }],
        outputs: [{ name: "MIDI Out", channels: 1 }],
      },
    };

    const config = defaultActiveConfig(io);
    expect(config.audio.inputs[0].layout).toBe("surround-5.1");
    expect(config.audio.outputs[0].layout).toBe("stereo");
    expect(config.midi.inputs[0].channels).toBe(16);
    expect(config.midi.outputs[0].channels).toBe(1);
    expect(config.audio.inputs[0].active).toBe(true);
    expect(config.audio.outputs[0].active).toBe(true);
  });
});
