// Core types
export type {
  Signal,
  AudioNodeDescriptor,
  ConnectionDescriptor,
  GraphOp,
  BridgeOutMessage,
  BridgeInMessage,
  ParameterConfig,
  MidiEvent,
  PluginConfig,
} from "./types.js";

export { createSignal } from "./types.js";

// Virtual audio graph
export { VirtualAudioGraph } from "./virtual-graph.js";
export type { VirtualAudioGraphSnapshot } from "./virtual-graph.js";

// Graph differ
export { diffGraphs } from "./graph-differ.js";

// Bridge
export { NativeBridge, bridge } from "./bridge.js";

// Contexts & PluginHost
export {
  AudioGraphContext,
  useAudioGraphContext,
  ParameterRegistryContext,
  TransportContext,
  MidiContext,
  HostInfoContext,
  PluginHost,
} from "./context.js";

export type {
  AudioGraphContextValue,
  ParameterEntry,
  ParameterRegistryContextValue,
  TransportState,
  HostInfo,
  PluginHostProps,
} from "./context.js";
