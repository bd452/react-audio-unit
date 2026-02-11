import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * useMix — crossfade / dry-wet mix between two signals.
 *
 * @param a   - "Dry" signal
 * @param b   - "Wet" signal
 * @param mix - 0 = 100% A, 1 = 100% B, 0.5 = equal blend
 */
export function useMix(a: Signal, b: Signal, mix: number): Signal {
  return useAudioNode("mix", { mix }, [a, b]);
}
