// ---------------------------------------------------------------------------
// Core type definitions for React Audio Unit
// ---------------------------------------------------------------------------

import {
  layoutFromChannelCount,
  type ChannelLayout,
  type ChannelLayoutOrCustom,
} from "./channel-layout.js";

/**
 * Opaque handle representing an audio signal in the virtual graph.
 * These never carry sample data — they're lightweight references that
 * the reconciler uses to track connections between nodes.
 */
export interface Signal {
  readonly __brand: "AudioSignal";
  readonly nodeId: string;
  readonly outlet: number;
}

export function createSignal(nodeId: string, outlet = 0): Signal {
  return { __brand: "AudioSignal", nodeId, outlet };
}

// ---------------------------------------------------------------------------
// Virtual audio graph types
// ---------------------------------------------------------------------------

export interface AudioNodeDescriptor {
  id: string;
  type: string;
  params: Record<string, number | string | boolean>;
  inputs: ConnectionDescriptor[];
}

export interface ConnectionDescriptor {
  fromNodeId: string;
  fromOutlet: number;
  toInlet: number;
}

// ---------------------------------------------------------------------------
// Graph operations — the "DOM operations" of our reconciler
// ---------------------------------------------------------------------------

export type GraphOp =
  | {
      op: "addNode";
      nodeId: string;
      nodeType: string;
      params: Record<string, number | string | boolean>;
    }
  | { op: "removeNode"; nodeId: string }
  | {
      op: "updateParams";
      nodeId: string;
      params: Record<string, number | string | boolean>;
    }
  | {
      op: "connect";
      from: { nodeId: string; outlet: number };
      to: { nodeId: string; inlet: number };
    }
  | {
      op: "disconnect";
      from: { nodeId: string; outlet: number };
      to: { nodeId: string; inlet: number };
    }
  | { op: "setOutput"; nodeId: string };

// ---------------------------------------------------------------------------
// Bridge protocol — messages between JS and native C++
// ---------------------------------------------------------------------------

/** JS → Native */
export type BridgeOutMessage =
  | { type: "graphOps"; ops: GraphOp[] }
  | { type: "paramUpdate"; nodeId: string; paramName: string; value: number }
  | { type: "registerParameter"; id: string; config: ParameterConfig }
  | { type: "unregisterParameter"; id: string }
  | { type: "setParameterValue"; id: string; value: number }
  | { type: "getState" }
  | { type: "setState"; state: string }
  | { type: "declareIOConfig"; config: PluginIOConfig };

/** Native → JS */
export type BridgeInMessage =
  | { type: "parameterChanged"; id: string; value: number }
  | { type: "meterData"; nodeId: string; rms: number[]; peak: number[] }
  | { type: "spectrumData"; nodeId: string; magnitudes: number[] }
  | {
      type: "transport";
      playing: boolean;
      bpm: number;
      positionSamples: number;
      timeSigNum: number;
      timeSigDen: number;
    }
  | { type: "midi"; busIndex: number; events: MidiEvent[] }
  | { type: "requestState" }
  | { type: "restoreState"; state: string }
  | { type: "sampleRate"; value: number }
  | { type: "blockSize"; value: number }
  | { type: "ioConfigChanged"; config: ActiveIOConfig };

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

export interface ParameterConfig {
  default: number;
  min: number;
  max: number;
  label: string;
  unit?: string;
  curve?: "linear" | "logarithmic" | "exponential";
  steps?: number;
}

// ---------------------------------------------------------------------------
// MIDI
// ---------------------------------------------------------------------------

export interface MidiEvent {
  type: "noteOn" | "noteOff" | "cc" | "pitchBend";
  channel: number;
  note?: number;
  velocity?: number;
  cc?: number;
  value?: number;
}

// ---------------------------------------------------------------------------
// Audio bus & MIDI bus configuration
// ---------------------------------------------------------------------------

/**
 * Describes a single audio bus (e.g. "Main Input", "Sidechain", "Main Output").
 *
 * Each bus lists the channel layouts it supports, ordered by preference
 * (first entry = most preferred). The host negotiates with the plugin to
 * pick the best mutually-supported layout — exactly like VST3's
 * `setBusArrangements()` or AU's supported channel layout tags.
 *
 * @example
 * ```ts
 * // A main stereo bus that also accepts mono
 * { name: "Main", layouts: ["stereo", "mono"] }
 *
 * // A surround bus that supports 5.1 and 7.1
 * { name: "Main", layouts: ["surround-5.1", "surround-7.1"] }
 *
 * // An optional sidechain (mono only)
 * { name: "Sidechain", layouts: ["mono"], optional: true }
 * ```
 */
export interface AudioBusConfig {
  /** Human-readable bus name shown in the DAW ("Main", "Sidechain", etc.) */
  name: string;
  /**
   * Supported channel layouts in preference order.
   * Must contain at least one layout.
   */
  layouts: ChannelLayoutOrCustom[];
  /**
   * Whether this bus is optional (can be deactivated by the host).
   * Main input/output buses are typically not optional.
   * @default false
   */
  optional?: boolean;
}

/**
 * Describes a single MIDI bus.
 *
 * Plugins can declare multiple MIDI input/output buses (e.g. a synth
 * with a main MIDI input and a secondary input for sidechain MIDI).
 *
 * @example
 * ```ts
 * { name: "MIDI In", channels: 16 }
 * { name: "MPE", channels: 16, optional: true }
 * ```
 */
export interface MidiBusConfig {
  /** Human-readable bus name. */
  name: string;
  /**
   * Number of MIDI channels (1–16).
   * @default 16
   */
  channels?: number;
  /**
   * Whether this bus is optional.
   * @default false
   */
  optional?: boolean;
}

/**
 * Complete I/O configuration for a plugin.
 *
 * Declares the audio and MIDI buses the plugin exposes to the host,
 * along with supported channel layout alternatives for each bus.
 * This follows the same bus-based model used by VST3, AU, and AAX.
 *
 * @example
 * ```ts
 * // Stereo effect with optional sidechain
 * const io: PluginIOConfig = {
 *   audio: {
 *     inputs: [
 *       { name: "Main", layouts: ["stereo", "mono"] },
 *       { name: "Sidechain", layouts: ["mono"], optional: true },
 *     ],
 *     outputs: [
 *       { name: "Main", layouts: ["stereo"] },
 *     ],
 *   },
 *   midi: {
 *     inputs: [{ name: "MIDI In" }],
 *   },
 * };
 *
 * // Instrument (no audio input, stereo output, MIDI input)
 * const io: PluginIOConfig = {
 *   audio: {
 *     inputs: [],
 *     outputs: [{ name: "Main", layouts: ["stereo"] }],
 *   },
 *   midi: {
 *     inputs: [{ name: "MIDI In" }],
 *   },
 * };
 * ```
 */
export interface PluginIOConfig {
  audio: {
    inputs: AudioBusConfig[];
    outputs: AudioBusConfig[];
  };
  /**
   * MIDI bus configuration. Omit entirely for plugins that do not
   * process MIDI at all (e.g. a pure gain effect).
   */
  midi?: {
    inputs?: MidiBusConfig[];
    outputs?: MidiBusConfig[];
  };
}

/**
 * A resolved/active I/O configuration after host negotiation.
 *
 * Whereas `PluginIOConfig` declares all *supported* layouts per bus,
 * `ActiveIOConfig` records which layout the host actually selected.
 */
export interface ActiveIOConfig {
  audio: {
    inputs: { name: string; layout: ChannelLayoutOrCustom; active: boolean }[];
    outputs: { name: string; layout: ChannelLayoutOrCustom; active: boolean }[];
  };
  midi: {
    inputs: { name: string; channels: number; active: boolean }[];
    outputs: { name: string; channels: number; active: boolean }[];
  };
}

// ---------------------------------------------------------------------------
// Plugin configuration (read from plugin.config.ts)
// ---------------------------------------------------------------------------

/**
 * Plugin configuration — the manifest that describes a plugin's identity,
 * I/O capabilities, and UI dimensions.
 *
 * The `io` field is the preferred way to declare I/O configuration.
 * The legacy `channels` field is still accepted for backward compatibility
 * and is automatically upgraded to a `PluginIOConfig` internally.
 *
 * @example
 * ```ts
 * // Modern — explicit I/O buses
 * export default {
 *   name: "My Effect",
 *   vendor: "My Company",
 *   vendorId: "MyCo",
 *   pluginId: "MyFx",
 *   version: "1.0.0",
 *   category: "Effect",
 *   formats: ["AU", "VST3"],
 *   io: {
 *     audio: {
 *       inputs:  [{ name: "Main", layouts: ["stereo", "mono"] }],
 *       outputs: [{ name: "Main", layouts: ["stereo"] }],
 *     },
 *     midi: { inputs: [{ name: "MIDI In" }] },
 *   },
 *   ui: { width: 600, height: 400 },
 * } satisfies PluginConfig;
 *
 * // Legacy — still works (auto-upgraded internally)
 * export default {
 *   ...
 *   channels: { input: 2, output: 2 },
 * } satisfies PluginConfig;
 * ```
 */
export interface PluginConfig {
  name: string;
  vendor: string;
  vendorId: string; // 4-char code
  pluginId: string; // 4-char code
  version: string;
  category: "Effect" | "Instrument" | "Analyzer";
  formats: ("AU" | "VST3" | "AAX")[];

  /**
   * Modern I/O configuration with named buses and layout alternatives.
   * Preferred over the legacy `channels` field.
   */
  io?: PluginIOConfig;

  /**
   * Legacy channel configuration (simple channel counts).
   *
   * @deprecated Use `io` instead. This field is retained for backward
   * compatibility and is auto-upgraded to a `PluginIOConfig` when only
   * `channels` is provided.
   */
  channels?: {
    input: number;
    output: number;
  };

  ui: {
    width: number;
    height: number;
    resizable?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Config resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a `PluginConfig` to a full `PluginIOConfig`, upgrading the
 * legacy `channels` field if necessary.
 *
 * Resolution rules:
 * - If `io` is present, it is returned as-is.
 * - If only `channels` is present, it is upgraded to a `PluginIOConfig`
 *   with a single "Main" bus on each side, using the inferred layout.
 * - If neither is present, defaults to stereo in/out for effects and
 *   analyzers, or no-input stereo-out for instruments.
 */
export function resolveIOConfig(config: PluginConfig): PluginIOConfig {
  if (config.io) {
    return config.io;
  }

  // Legacy upgrade path
  const inputCount = config.channels?.input ?? (config.category === "Instrument" ? 0 : 2);
  const outputCount = config.channels?.output ?? 2;

  const inputs: AudioBusConfig[] =
    inputCount > 0
      ? [{ name: "Main", layouts: [layoutFromChannelCount(inputCount)] }]
      : [];

  const outputs: AudioBusConfig[] =
    outputCount > 0
      ? [{ name: "Main", layouts: [layoutFromChannelCount(outputCount)] }]
      : [];

  const io: PluginIOConfig = {
    audio: { inputs, outputs },
  };

  // Instruments get a MIDI input by default
  if (config.category === "Instrument") {
    io.midi = { inputs: [{ name: "MIDI In" }] };
  }

  return io;
}
