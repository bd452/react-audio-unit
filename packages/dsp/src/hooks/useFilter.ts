import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export type FilterType =
  | "lowpass"
  | "highpass"
  | "bandpass"
  | "notch"
  | "allpass"
  | "lowshelf"
  | "highshelf"
  | "peaking";

export interface FilterParams {
  type: FilterType;
  /** Cutoff / center frequency in Hz. */
  cutoff: number;
  /** Resonance / Q factor. Default 0.707 (Butterworth). */
  resonance?: number;
  /** Gain in dB (only used for shelf and peaking types). */
  gainDb?: number;
  bypass?: boolean;
}

/**
 * useFilter — biquad filter with multiple types.
 *
 * The native implementation uses JUCE's dsp::IIR::Filter with
 * coefficient smoothing for click-free parameter changes.
 */
export function useFilter(input: Signal, params: FilterParams): Signal {
  return useAudioNode(
    "filter",
    {
      filterType: params.type,
      cutoff: params.cutoff,
      resonance: params.resonance ?? 0.707,
      gainDb: params.gainDb ?? 0,
      bypass: params.bypass ?? false,
    },
    [input],
  );
}
