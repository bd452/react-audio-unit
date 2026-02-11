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
  | { type: "blockSize"; value: number };

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

export interface PluginConfig {
  name: string;
  vendor: string;
  vendorId: string; // 4-char code
  pluginId: string; // 4-char code
  version: string;
  category: "Effect" | "Instrument" | "Analyzer";
  formats: ("AU" | "VST3" | "AAX")[];
  channels: {
    input: number;
    output: number;
  };
  ui: {
    width: number;
    height: number;
    resizable?: boolean;
  };
}
