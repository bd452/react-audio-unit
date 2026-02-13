import { describe, it, expect } from "vitest";
import {
  channelCount,
  speakersFor,
  isNamedLayout,
  isCustomLayout,
  layoutsEqual,
  layoutDisplayName,
  layoutFromChannelCount,
  customLayout,
  ALL_NAMED_LAYOUTS,
  LAYOUT_SPEAKERS,
  type ChannelLayout,
  type CustomChannelLayout,
} from "../channel-layout.js";

describe("channelCount", () => {
  it("returns correct count for named layouts", () => {
    expect(channelCount("mono")).toBe(1);
    expect(channelCount("stereo")).toBe(2);
    expect(channelCount("LCR")).toBe(3);
    expect(channelCount("surround-2.1")).toBe(3);
    expect(channelCount("quad")).toBe(4);
    expect(channelCount("surround-5.0")).toBe(5);
    expect(channelCount("surround-5.1")).toBe(6);
    expect(channelCount("surround-7.1")).toBe(8);
    expect(channelCount("surround-7.1.2")).toBe(10);
    expect(channelCount("surround-7.1.4")).toBe(12);
    expect(channelCount("ambisonics-1")).toBe(4);
  });

  it("returns correct count for custom layouts", () => {
    expect(channelCount({ type: "custom", channels: 3 })).toBe(3);
    expect(channelCount({ type: "custom", channels: 16 })).toBe(16);
    expect(channelCount({ type: "custom", channels: 0 })).toBe(0);
  });
});

describe("speakersFor", () => {
  it("returns correct speakers for stereo", () => {
    expect(speakersFor("stereo")).toEqual(["L", "R"]);
  });

  it("returns correct speakers for 5.1", () => {
    expect(speakersFor("surround-5.1")).toEqual([
      "L",
      "R",
      "C",
      "LFE",
      "Ls",
      "Rs",
    ]);
  });

  it("returns correct speakers for mono", () => {
    expect(speakersFor("mono")).toEqual(["C"]);
  });

  it("returns explicit speakers for custom layout", () => {
    const custom: CustomChannelLayout = {
      type: "custom",
      channels: 2,
      speakers: ["L", "R"],
    };
    expect(speakersFor(custom)).toEqual(["L", "R"]);
  });

  it("returns empty array for custom without speakers", () => {
    expect(speakersFor({ type: "custom", channels: 3 })).toEqual([]);
  });
});

describe("isNamedLayout / isCustomLayout", () => {
  it("identifies named layouts", () => {
    expect(isNamedLayout("stereo")).toBe(true);
    expect(isNamedLayout("surround-7.1.4")).toBe(true);
    expect(isNamedLayout({ type: "custom", channels: 2 })).toBe(false);
  });

  it("identifies custom layouts", () => {
    expect(isCustomLayout({ type: "custom", channels: 2 })).toBe(true);
    expect(isCustomLayout("stereo")).toBe(false);
  });
});

describe("layoutsEqual", () => {
  it("matches identical named layouts", () => {
    expect(layoutsEqual("stereo", "stereo")).toBe(true);
    expect(layoutsEqual("surround-5.1", "surround-5.1")).toBe(true);
  });

  it("does not match different named layouts", () => {
    expect(layoutsEqual("mono", "stereo")).toBe(false);
    expect(layoutsEqual("surround-5.1", "surround-7.1")).toBe(false);
  });

  it("matches custom layout with same count (no speakers)", () => {
    expect(
      layoutsEqual(
        { type: "custom", channels: 2 },
        { type: "custom", channels: 2 },
      ),
    ).toBe(true);
  });

  it("does not match custom layouts with different counts", () => {
    expect(
      layoutsEqual(
        { type: "custom", channels: 2 },
        { type: "custom", channels: 3 },
      ),
    ).toBe(false);
  });

  it("matches custom layout with named layout by count when no speakers", () => {
    // Custom 2-channel matches stereo by count
    expect(layoutsEqual({ type: "custom", channels: 2 }, "stereo")).toBe(true);
  });

  it("matches custom with explicit speakers to named layout", () => {
    const customStereo: CustomChannelLayout = {
      type: "custom",
      channels: 2,
      speakers: ["L", "R"],
    };
    expect(layoutsEqual(customStereo, "stereo")).toBe(true);
  });

  it("does not match custom with wrong speakers", () => {
    const customMidSide: CustomChannelLayout = {
      type: "custom",
      channels: 2,
      speakers: ["C", "LFE"], // wrong speakers for stereo
    };
    // Both have 2 channels but different speakers
    expect(layoutsEqual(customMidSide, "stereo")).toBe(false);
  });
});

describe("layoutDisplayName", () => {
  it("returns display names for common layouts", () => {
    expect(layoutDisplayName("mono")).toBe("Mono");
    expect(layoutDisplayName("stereo")).toBe("Stereo");
    expect(layoutDisplayName("surround-5.1")).toBe("5.1 Surround");
    expect(layoutDisplayName("surround-7.1.4")).toBe("7.1.4 Dolby Atmos");
    expect(layoutDisplayName("ambisonics-1")).toBe("Ambisonics 1st Order");
  });

  it("returns label for custom layout", () => {
    expect(
      layoutDisplayName({ type: "custom", channels: 2, label: "Mid-Side" }),
    ).toBe("Mid-Side");
  });

  it("returns generic name for unlabelled custom layout", () => {
    expect(layoutDisplayName({ type: "custom", channels: 4 })).toBe(
      "4ch Custom",
    );
  });
});

describe("layoutFromChannelCount", () => {
  it("maps common channel counts to named layouts", () => {
    expect(layoutFromChannelCount(1)).toBe("mono");
    expect(layoutFromChannelCount(2)).toBe("stereo");
    expect(layoutFromChannelCount(6)).toBe("surround-5.1");
    expect(layoutFromChannelCount(8)).toBe("surround-7.1");
    expect(layoutFromChannelCount(12)).toBe("surround-7.1.4");
  });

  it("returns custom layout for 0 channels", () => {
    const result = layoutFromChannelCount(0);
    expect(typeof result).toBe("object");
    expect((result as CustomChannelLayout).channels).toBe(0);
  });

  it("returns custom layout for unrecognised counts", () => {
    const result = layoutFromChannelCount(13);
    expect(typeof result).toBe("object");
    expect((result as CustomChannelLayout).channels).toBe(13);
  });
});

describe("customLayout", () => {
  it("creates a custom layout with options", () => {
    const layout = customLayout(2, { label: "Binaural", speakers: ["L", "R"] });
    expect(layout.type).toBe("custom");
    expect(layout.channels).toBe(2);
    expect(layout.label).toBe("Binaural");
    expect(layout.speakers).toEqual(["L", "R"]);
  });

  it("creates a minimal custom layout", () => {
    const layout = customLayout(4);
    expect(layout.type).toBe("custom");
    expect(layout.channels).toBe(4);
    expect(layout.label).toBeUndefined();
    expect(layout.speakers).toBeUndefined();
  });
});

describe("ALL_NAMED_LAYOUTS", () => {
  it("contains all layouts defined in LAYOUT_SPEAKERS", () => {
    const speakerKeys = Object.keys(LAYOUT_SPEAKERS);
    for (const key of speakerKeys) {
      expect(ALL_NAMED_LAYOUTS).toContain(key);
    }
  });

  it("every named layout has a valid channel count > 0", () => {
    for (const layout of ALL_NAMED_LAYOUTS) {
      expect(channelCount(layout)).toBeGreaterThan(0);
    }
  });
});

describe("LAYOUT_SPEAKERS consistency", () => {
  it("speaker count matches channelCount for all named layouts", () => {
    for (const layout of ALL_NAMED_LAYOUTS) {
      const speakers = LAYOUT_SPEAKERS[layout];
      expect(speakers.length).toBe(channelCount(layout));
    }
  });
});
