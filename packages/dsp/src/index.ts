// Canonical parameter key constants (shared source of truth with C++ nodes)
export * from "./param-keys.js";

// Core audio node hook
export { useAudioNode } from "./useAudioNode.js";

// I/O
export { useInput } from "./hooks/useInput.js";
export { useOutput } from "./hooks/useOutput.js";

// Parameters
export { useParameter } from "./hooks/useParameter.js";

// DSP nodes
export { useGain } from "./hooks/useGain.js";
export type { GainParams } from "./hooks/useGain.js";

export { useDelay } from "./hooks/useDelay.js";
export type { DelayParams } from "./hooks/useDelay.js";

export { useFilter } from "./hooks/useFilter.js";
export type { FilterParams, FilterType } from "./hooks/useFilter.js";

export { useMix } from "./hooks/useMix.js";

export { useOscillator } from "./hooks/useOscillator.js";
export type { OscillatorParams, WaveformType } from "./hooks/useOscillator.js";

export { useCompressor } from "./hooks/useCompressor.js";
export type { CompressorParams } from "./hooks/useCompressor.js";

export { useReverb } from "./hooks/useReverb.js";
export type { ReverbParams } from "./hooks/useReverb.js";

export { useConvolver } from "./hooks/useConvolver.js";
export type { ConvolverParams } from "./hooks/useConvolver.js";

export { useDistortion } from "./hooks/useDistortion.js";
export type {
  DistortionParams,
  DistortionType,
} from "./hooks/useDistortion.js";

export { usePan } from "./hooks/usePan.js";
export type { PanParams } from "./hooks/usePan.js";

export { useLFO } from "./hooks/useLFO.js";
export type { LFOParams, LFOShape } from "./hooks/useLFO.js";

export { useEnvelope } from "./hooks/useEnvelope.js";
export type { EnvelopeParams } from "./hooks/useEnvelope.js";

// Composite effects
export { useChorus } from "./hooks/useChorus.js";
export type { ChorusParams } from "./hooks/useChorus.js";

export { useFlanger } from "./hooks/useFlanger.js";
export type { FlangerParams } from "./hooks/useFlanger.js";

export { usePhaser } from "./hooks/usePhaser.js";
export type { PhaserParams } from "./hooks/usePhaser.js";

// Channel routing
export { useChannelSplit } from "./hooks/useChannelSplit.js";
export { useChannelMerge } from "./hooks/useChannelMerge.js";
// Aliases matching SUMMARY.md naming
export { useChannelSplit as useSplit } from "./hooks/useChannelSplit.js";
export { useChannelMerge as useMerge } from "./hooks/useChannelMerge.js";

// Analysis
export { useMeter } from "./hooks/useMeter.js";
export type { MeterData, MeterType } from "./hooks/useMeter.js";

export { useSpectrum } from "./hooks/useSpectrum.js";
export type { SpectrumData } from "./hooks/useSpectrum.js";

// MIDI & transport
export { useMidi } from "./hooks/useMidi.js";
export { useTransport } from "./hooks/useTransport.js";
export { useHostInfo } from "./hooks/useHostInfo.js";

// Polyphony
export { usePolyphony, midiNoteToFrequency } from "./hooks/usePolyphony.js";
export type {
  Voice,
  VoiceStealingStrategy,
  PolyphonyOptions,
  PolyphonyState,
} from "./hooks/usePolyphony.js";

// Presets
export { usePresets } from "./hooks/usePresets.js";
export type {
  Preset,
  PresetManager,
  PresetManagerOptions,
} from "./hooks/usePresets.js";
