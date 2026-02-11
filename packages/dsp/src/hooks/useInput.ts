import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * useInput — provides the audio input signal from the DAW.
 *
 * For effects, this is the audio on the track. For instruments,
 * this may be a sidechain input or unused.
 *
 * @param channel - Input bus index (default 0 = main stereo input)
 */
export function useInput(channel = 0): Signal {
  return useAudioNode("input", { channel });
}
