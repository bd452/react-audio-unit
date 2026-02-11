import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface DelayParams {
  /** Delay time in milliseconds. */
  time: number;
  /** Feedback amount (0–1). 0 = no feedback, approaching 1 = infinite. */
  feedback?: number;
  /** Dry/wet mix (0 = fully dry, 1 = fully wet). */
  mix?: number;
  bypass?: boolean;
}

/**
 * useDelay — applies a delay line to an audio signal.
 *
 * The native implementation uses a circular buffer with linear
 * interpolation for smooth time changes.
 */
export function useDelay(input: Signal, params: DelayParams): Signal {
  return useAudioNode(
    "delay",
    {
      time: params.time,
      feedback: params.feedback ?? 0,
      mix: params.mix ?? 1,
      bypass: params.bypass ?? false,
    },
    [input],
  );
}
