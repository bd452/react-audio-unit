// ---------------------------------------------------------------------------
// Core type definitions for React Audio Unit
// ---------------------------------------------------------------------------

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

export interface HostAudioBusLayout {
  /**
   * Normalized layout token, e.g. "mono", "stereo", "5.1", "7.1.4",
   * "disabled", or "discrete:12".
   */
  layout: string;
  channels: number;
}

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
  | { type: "setState"; state: string };

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
  | { type: "midi"; events: MidiEvent[] }
  | { type: "requestState" }
  | { type: "restoreState"; state: string }
  | { type: "sampleRate"; value: number }
  | { type: "blockSize"; value: number }
  | {
      type: "audioLayout";
      mainInput: HostAudioBusLayout;
      mainOutput: HostAudioBusLayout;
      sidechainInput?: HostAudioBusLayout;
    };

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
// Plugin configuration (read from plugin.config.ts)
// ---------------------------------------------------------------------------

export type AudioChannelLayoutName =
  | "disabled"
  | "mono"
  | "stereo"
  | "lcr"
  | "2.1"
  | "quad"
  | "4.0"
  | "4.1"
  | "5.0"
  | "5.1"
  | "6.0"
  | "6.1"
  | "7.0"
  | "7.1"
  | "7.1.2"
  | "7.1.4"
  | "9.1.6"
  | "atmos"
  | "atmos-7.1.2"
  | "atmos-7.1.4"
  | "atmos-9.1.6";

export interface DiscreteAudioChannelLayout {
  layout: "discrete";
  channels: number;
}

/**
 * Audio layout value used in plugin configuration.
 *
 * - String values use standard layout names (`"mono"`, `"stereo"`, `"5.1"`, etc.)
 * - Number values are treated as discrete channel counts (`0`, `1`, `2`, ...)
 * - `{ layout: "discrete", channels: n }` is an explicit discrete layout
 */
export type AudioChannelLayout =
  | AudioChannelLayoutName
  | number
  | DiscreteAudioChannelLayout;

/**
 * One accepted main-bus arrangement (input/output pair).
 *
 * Plugins typically expose multiple alternatives like:
 * - mono -> mono
 * - stereo -> stereo
 * - 5.1 -> 5.1
 */
export interface AudioMainBusArrangement {
  input: AudioChannelLayout;
  output: AudioChannelLayout;
  name?: string;
}

export interface AudioSidechainConfig {
  /**
   * Supported sidechain channel layouts. Include `"disabled"` to allow hosts
   * to disable the sidechain bus.
   */
  supported: AudioChannelLayout[];
  /**
   * If true, sidechain bus may be disabled by the host.
   * Defaults to true when omitted.
   */
  optional?: boolean;
}

export interface PluginAudioIOConfig {
  /**
   * Main input/output alternatives accepted by the plugin.
   */
  main: AudioMainBusArrangement[];
  /**
   * Optional sidechain bus capabilities.
   */
  sidechain?: AudioSidechainConfig;
}

export interface PluginMidiIOConfig {
  /**
   * Whether the plugin accepts MIDI input from the host.
   */
  input?: boolean;
  /**
   * Whether the plugin can emit MIDI output to the host.
   */
  output?: boolean;
}

export interface PluginIOConfig {
  audio?: PluginAudioIOConfig;
  midi?: PluginMidiIOConfig;
}

interface PluginConfigBase {
  name: string;
  vendor: string;
  vendorId: string; // 4-char code
  pluginId: string; // 4-char code
  version: string;
  category: "Effect" | "Instrument" | "Analyzer";
  formats: ("AU" | "VST3" | "AAX")[];
  ui: {
    width: number;
    height: number;
    resizable?: boolean;
  };
}

interface PluginConfigLegacyChannels {
  /**
   * @deprecated Use `io.audio.main` instead.
   */
  channels: {
    input: number;
    output: number;
  };
  io?: PluginIOConfig;
}

interface PluginConfigCapabilityIO {
  io: PluginIOConfig;
  /**
   * @deprecated Kept for backward compatibility.
   */
  channels?: {
    input: number;
    output: number;
  };
}

export type PluginConfig = PluginConfigBase &
  (PluginConfigLegacyChannels | PluginConfigCapabilityIO);
