// ---------------------------------------------------------------------------
// Channel layout definitions for React Audio Unit
//
// Modelled after the industry-standard speaker arrangements used across
// VST3 (Steinberg::Vst::SpeakerArr), AU (AudioChannelLayout), and
// AAX (AAX_eStemFormat). These layouts are the common currency that
// hosts and plugins use to negotiate I/O configurations.
// ---------------------------------------------------------------------------

/**
 * Individual speaker position labels following the ITU / Dolby / SMPTE
 * naming conventions used by all major plugin formats.
 */
export type SpeakerLabel =
  // Front
  | "L" // Left
  | "R" // Right
  | "C" // Center
  // Low-frequency
  | "LFE" // Low-Frequency Effects (subwoofer)
  // Surround (rear / side)
  | "Ls" // Left Surround (rear-left)
  | "Rs" // Right Surround (rear-right)
  | "Lss" // Left Side Surround
  | "Rss" // Right Side Surround
  | "Cs" // Center Surround (rear-center)
  // Top / Height (Dolby Atmos bed channels)
  | "Tfl" // Top Front Left
  | "Tfr" // Top Front Right
  | "Trl" // Top Rear Left
  | "Trr" // Top Rear Right
  | "Tfc" // Top Front Center
  | "Trc" // Top Rear Center
  | "Tsl" // Top Side Left
  | "Tsr" // Top Side Right
  // Ambisonics (ACN ordering)
  | "W" // Omni (0th order)
  | "Y" // 1st order
  | "Z" // 1st order
  | "X"; // 1st order

/**
 * A channel layout describes the speaker arrangement for an audio bus.
 *
 * Named layouts cover the standard configurations that every DAW and
 * plugin format recognises. The `custom` variant allows defining
 * arbitrary channel counts with an optional descriptive label.
 */
export type ChannelLayout =
  | "mono" // 1ch: C
  | "stereo" // 2ch: L, R
  | "LCR" // 3ch: L, R, C
  | "surround-2.1" // 3ch: L, R, LFE
  | "quad" // 4ch: L, R, Ls, Rs
  | "surround-4.0" // 4ch: L, R, C, Cs
  | "surround-4.1" // 5ch: L, R, LFE, Ls, Rs
  | "surround-5.0" // 5ch: L, R, C, Ls, Rs
  | "surround-5.1" // 6ch: L, R, C, LFE, Ls, Rs
  | "surround-6.0" // 6ch: L, R, C, Ls, Rs, Cs
  | "surround-6.1" // 7ch: L, R, C, LFE, Ls, Rs, Cs
  | "surround-7.0" // 7ch: L, R, C, Ls, Rs, Lss, Rss
  | "surround-7.1" // 8ch: L, R, C, LFE, Ls, Rs, Lss, Rss
  | "surround-7.1.2" // 10ch: 7.1 + Tfl, Tfr
  | "surround-7.1.4" // 12ch: 7.1 + Tfl, Tfr, Trl, Trr
  | "ambisonics-1" // 4ch:  1st-order Ambisonics (W, Y, Z, X)
  | "ambisonics-2" // 9ch:  2nd-order Ambisonics
  | "ambisonics-3"; // 16ch: 3rd-order Ambisonics

/**
 * Custom channel layout for non-standard configurations.
 * Used when none of the named layouts apply.
 */
export interface CustomChannelLayout {
  readonly type: "custom";
  /** Number of audio channels. */
  readonly channels: number;
  /** Optional descriptive label (e.g. "Binaural", "Mid-Side"). */
  readonly label?: string;
  /** Optional explicit speaker labels for each channel. */
  readonly speakers?: readonly SpeakerLabel[];
}

/**
 * Union type for any channel layout — either a named standard layout
 * or a custom layout descriptor.
 */
export type ChannelLayoutOrCustom = ChannelLayout | CustomChannelLayout;

// ---------------------------------------------------------------------------
// Speaker arrangement tables
// ---------------------------------------------------------------------------

/**
 * Maps each named layout to its ordered list of speaker labels.
 * The order matches the interleaved sample ordering expected by
 * the native audio engine.
 */
export const LAYOUT_SPEAKERS: Readonly<
  Record<ChannelLayout, readonly SpeakerLabel[]>
> = {
  mono: ["C"],
  stereo: ["L", "R"],
  LCR: ["L", "R", "C"],
  "surround-2.1": ["L", "R", "LFE"],
  quad: ["L", "R", "Ls", "Rs"],
  "surround-4.0": ["L", "R", "C", "Cs"],
  "surround-4.1": ["L", "R", "LFE", "Ls", "Rs"],
  "surround-5.0": ["L", "R", "C", "Ls", "Rs"],
  "surround-5.1": ["L", "R", "C", "LFE", "Ls", "Rs"],
  "surround-6.0": ["L", "R", "C", "Ls", "Rs", "Cs"],
  "surround-6.1": ["L", "R", "C", "LFE", "Ls", "Rs", "Cs"],
  "surround-7.0": ["L", "R", "C", "Ls", "Rs", "Lss", "Rss"],
  "surround-7.1": ["L", "R", "C", "LFE", "Ls", "Rs", "Lss", "Rss"],
  "surround-7.1.2": [
    "L",
    "R",
    "C",
    "LFE",
    "Ls",
    "Rs",
    "Lss",
    "Rss",
    "Tfl",
    "Tfr",
  ],
  "surround-7.1.4": [
    "L",
    "R",
    "C",
    "LFE",
    "Ls",
    "Rs",
    "Lss",
    "Rss",
    "Tfl",
    "Tfr",
    "Trl",
    "Trr",
  ],
  "ambisonics-1": ["W", "Y", "Z", "X"],
  "ambisonics-2": [
    "W",
    "Y",
    "Z",
    "X",
    "W",
    "Y",
    "Z",
    "X",
    "W", // placeholder — full ACN layout
  ],
  "ambisonics-3": [
    "W",
    "Y",
    "Z",
    "X",
    "W",
    "Y",
    "Z",
    "X",
    "W",
    "Y",
    "Z",
    "X",
    "W",
    "Y",
    "Z",
    "X",
  ],
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Returns the number of audio channels for a given layout.
 */
export function channelCount(layout: ChannelLayoutOrCustom): number {
  if (typeof layout === "string") {
    return LAYOUT_SPEAKERS[layout].length;
  }
  return layout.channels;
}

/**
 * Returns the ordered speaker labels for a layout.
 * Custom layouts return their explicit speakers, or generic labels
 * ("Ch1", "Ch2", …) when speakers are not specified.
 */
export function speakersFor(
  layout: ChannelLayoutOrCustom,
): readonly SpeakerLabel[] {
  if (typeof layout === "string") {
    return LAYOUT_SPEAKERS[layout];
  }
  return layout.speakers ?? [];
}

/**
 * Returns true if the layout is a named standard layout.
 */
export function isNamedLayout(
  layout: ChannelLayoutOrCustom,
): layout is ChannelLayout {
  return typeof layout === "string";
}

/**
 * Returns true if the layout is a custom layout.
 */
export function isCustomLayout(
  layout: ChannelLayoutOrCustom,
): layout is CustomChannelLayout {
  return typeof layout !== "string" && layout.type === "custom";
}

/**
 * Checks whether two layouts are equivalent (same channel arrangement).
 *
 * Two named layouts match if they are the same string. A custom layout
 * matches a named layout if it has the same channel count AND the same
 * speaker labels (when specified). Two custom layouts match if they
 * have the same channel count and speakers.
 */
export function layoutsEqual(
  a: ChannelLayoutOrCustom,
  b: ChannelLayoutOrCustom,
): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a === b;
  }
  const countA = channelCount(a);
  const countB = channelCount(b);
  if (countA !== countB) return false;

  const speakersA = speakersFor(a);
  const speakersB = speakersFor(b);
  if (speakersA.length > 0 && speakersB.length > 0) {
    if (speakersA.length !== speakersB.length) return false;
    return speakersA.every((s, i) => s === speakersB[i]);
  }
  // If either doesn't have explicit speakers, compare by count only
  return true;
}

/**
 * Returns a human-readable display name for a channel layout.
 */
export function layoutDisplayName(layout: ChannelLayoutOrCustom): string {
  if (typeof layout === "string") {
    return LAYOUT_DISPLAY_NAMES[layout] ?? layout;
  }
  return layout.label ?? `${layout.channels}ch Custom`;
}

const LAYOUT_DISPLAY_NAMES: Partial<Record<ChannelLayout, string>> = {
  mono: "Mono",
  stereo: "Stereo",
  LCR: "LCR (3.0)",
  "surround-2.1": "2.1",
  quad: "Quad",
  "surround-4.0": "4.0 Surround",
  "surround-4.1": "4.1 Surround",
  "surround-5.0": "5.0 Surround",
  "surround-5.1": "5.1 Surround",
  "surround-6.0": "6.0 Surround",
  "surround-6.1": "6.1 Surround",
  "surround-7.0": "7.0 Surround",
  "surround-7.1": "7.1 Surround",
  "surround-7.1.2": "7.1.2 Dolby Atmos",
  "surround-7.1.4": "7.1.4 Dolby Atmos",
  "ambisonics-1": "Ambisonics 1st Order",
  "ambisonics-2": "Ambisonics 2nd Order",
  "ambisonics-3": "Ambisonics 3rd Order",
};

/**
 * Attempts to infer a named ChannelLayout from a plain channel count.
 * This is used for backward compatibility with the old `channels: { input: N, output: N }`
 * config format. Returns "mono" for 1, "stereo" for 2, "surround-5.1" for 6, etc.
 * Falls back to a CustomChannelLayout for unrecognised counts.
 */
export function layoutFromChannelCount(
  count: number,
): ChannelLayoutOrCustom {
  switch (count) {
    case 0:
      return { type: "custom", channels: 0, label: "None" };
    case 1:
      return "mono";
    case 2:
      return "stereo";
    case 3:
      return "LCR";
    case 4:
      return "quad";
    case 5:
      return "surround-5.0";
    case 6:
      return "surround-5.1";
    case 7:
      return "surround-6.1";
    case 8:
      return "surround-7.1";
    case 10:
      return "surround-7.1.2";
    case 12:
      return "surround-7.1.4";
    default:
      return { type: "custom", channels: count };
  }
}

/**
 * Helper to create a custom channel layout.
 */
export function customLayout(
  channels: number,
  options?: { label?: string; speakers?: SpeakerLabel[] },
): CustomChannelLayout {
  return {
    type: "custom",
    channels,
    label: options?.label,
    speakers: options?.speakers,
  };
}

/**
 * All named layouts ordered by channel count (ascending).
 * Useful for UI display or iteration.
 */
export const ALL_NAMED_LAYOUTS: readonly ChannelLayout[] = [
  "mono",
  "stereo",
  "LCR",
  "surround-2.1",
  "quad",
  "surround-4.0",
  "surround-4.1",
  "surround-5.0",
  "surround-5.1",
  "surround-6.0",
  "surround-6.1",
  "surround-7.0",
  "surround-7.1",
  "surround-7.1.2",
  "surround-7.1.4",
  "ambisonics-1",
  "ambisonics-2",
  "ambisonics-3",
];
