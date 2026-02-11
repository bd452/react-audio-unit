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

// Analysis
export { useMeter } from "./hooks/useMeter.js";
export type { MeterData, MeterType } from "./hooks/useMeter.js";

export { useSpectrum } from "./hooks/useSpectrum.js";
export type { SpectrumData } from "./hooks/useSpectrum.js";

// MIDI & transport
export { useMidi } from "./hooks/useMidi.js";
export { useTransport } from "./hooks/useTransport.js";
export { useHostInfo } from "./hooks/useHostInfo.js";
