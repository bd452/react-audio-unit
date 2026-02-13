import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import { PARAM_MIX, PARAM_GAIN, PARAM_BYPASS } from "../param-keys.js";

export interface ConvolverParams {
  /** Dry/wet mix (0 = fully dry, 1 = fully wet). Default 0.5. */
  mix?: number;
  /** Output gain (linear). Default 1. */
  gain?: number;
  bypass?: boolean;
}

/**
 * useConvolver — convolution reverb using an impulse response.
 *
 * The native ConvolverNode uses JUCE's uniformly-partitioned
 * convolution engine for efficient frequency-domain processing.
 *
 * Note: The IR must be loaded on the C++ side via loadIR() or
 * loadIRFromFile(). This hook sets up the convolution node in
 * the graph and controls its mix/gain parameters.
 */
export function useConvolver(
  input: Signal,
  params: ConvolverParams = {},
): Signal {
  return useAudioNode(
    "convolver",
    {
      [PARAM_MIX]: params.mix ?? 0.5,
      [PARAM_GAIN]: params.gain ?? 1,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    [input],
  );
}
