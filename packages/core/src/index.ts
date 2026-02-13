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
  AudioBusConfig,
  MidiBusConfig,
  PluginIOConfig,
  ActiveIOConfig,
} from "./types.js";

export { createSignal, resolveIOConfig } from "./types.js";

// Channel layout types & utilities
export type {
  SpeakerLabel,
  ChannelLayout,
  CustomChannelLayout,
  ChannelLayoutOrCustom,
} from "./channel-layout.js";

export {
  LAYOUT_SPEAKERS,
  ALL_NAMED_LAYOUTS,
  channelCount,
  speakersFor,
  isNamedLayout,
  isCustomLayout,
  layoutsEqual,
  layoutDisplayName,
  layoutFromChannelCount,
  customLayout,
} from "./channel-layout.js";

// I/O negotiation
export type {
  BusNegotiationResult,
  HostBusProposal,
  IONegotiationResult,
} from "./io-negotiation.js";

export {
  negotiateBusLayout,
  negotiateIOConfig,
  findCommonLayouts,
  busSupportsLayout,
  defaultActiveConfig,
} from "./io-negotiation.js";

// Virtual audio graph
export { VirtualAudioGraph } from "./virtual-graph.js";
export type { VirtualAudioGraphSnapshot } from "./virtual-graph.js";

// Graph differ
export { diffGraphs, diffGraphsFull } from "./graph-differ.js";
export type { DiffResult } from "./graph-differ.js";

// Bridge
export { NativeBridge, bridge } from "./bridge.js";

// Dev bridge (browser mock)
export { installDevBridge, autoInstallDevBridge } from "./dev-bridge.js";

// Contexts & PluginHost
export {
  AudioGraphContext,
  useAudioGraphContext,
  ParameterRegistryContext,
  TransportContext,
  MidiContext,
  IOConfigContext,
  HostInfoContext,
  PluginHost,
} from "./context.js";

export type {
  AudioGraphContextValue,
  ParameterEntry,
  ParameterRegistryContextValue,
  TransportState,
  MidiBusEvents,
  HostInfo,
  PluginHostProps,
} from "./context.js";
