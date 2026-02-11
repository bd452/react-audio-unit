import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

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
      mix: params.mix ?? 0.5,
      gain: params.gain ?? 1,
      bypass: params.bypass ?? false,
    },
    [input],
  );
}
