import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_FILTER_TYPE,
  PARAM_CUTOFF,
  PARAM_RESONANCE,
  PARAM_GAIN_DB,
  PARAM_BYPASS,
} from "../param-keys.js";

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
      [PARAM_FILTER_TYPE]: params.type,
      [PARAM_CUTOFF]: params.cutoff,
      [PARAM_RESONANCE]: params.resonance ?? 0.707,
      [PARAM_GAIN_DB]: params.gainDb ?? 0,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    [input],
  );
}
