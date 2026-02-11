import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface ReverbParams {
  /** Room size (0–1). */
  roomSize: number;
  /** High-frequency damping (0–1). */
  damping: number;
  /** Dry/wet mix (0–1). */
  mix: number;
  /** Pre-delay in ms. */
  preDelay?: number;
  bypass?: boolean;
}

/**
 * useReverb — algorithmic reverb (Freeverb-based).
 */
export function useReverb(input: Signal, params: ReverbParams): Signal {
  return useAudioNode(
    "reverb",
    {
      roomSize: params.roomSize,
      damping: params.damping,
      mix: params.mix,
      preDelay: params.preDelay ?? 0,
      bypass: params.bypass ?? false,
    },
    [input],
  );
}
