import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * useChannelMerge — combines two mono signals into a stereo signal.
 *
 * @param left  - Signal routed to the left channel (inlet 0)
 * @param right - Signal routed to the right channel (inlet 1)
 * @returns Stereo signal with left on ch 0, right on ch 1.
 *          If only `left` is provided, it is copied to both channels.
 */
export function useChannelMerge(left: Signal, right: Signal): Signal {
  return useAudioNode("merge", { bypass: false }, [left, right]);
}
