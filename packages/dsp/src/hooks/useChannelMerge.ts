import type { Signal } from "@react-audio-unit/core";
import {
  channelCount,
  type ChannelLayoutOrCustom,
} from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * Options for merging channels, supporting both positional and named inputs.
 */
export interface ChannelMergeOptions {
  /**
   * Target output layout. Determines how many channels the merged signal has.
   * @default "stereo"
   */
  layout?: ChannelLayoutOrCustom;
}

/**
 * useChannelMerge — combines multiple mono/individual channel signals into
 * a multi-channel signal.
 *
 * The number of input signals should match the channel count of the target
 * layout. For stereo, pass `[left, right]`; for 5.1, pass 6 signals in
 * standard speaker order (L, R, C, LFE, Ls, Rs).
 *
 * If fewer signals are provided than the layout requires, the missing
 * channels are filled with silence. If more signals are provided, the
 * extras are ignored.
 *
 * @param inputs  - Array of per-channel signals in speaker order.
 * @param options - Merge options including the target layout.
 * @returns A single multi-channel signal with the specified layout.
 *
 * @example
 * ```tsx
 * // Stereo merge (backward compatible with 2-arg form)
 * const stereo = useChannelMerge([left, right]);
 *
 * // 5.1 surround merge
 * const surround = useChannelMerge(
 *   [L, R, C, LFE, Ls, Rs],
 *   { layout: "surround-5.1" },
 * );
 *
 * // Mono to stereo (duplicate to both channels)
 * const stereo = useChannelMerge([mono, mono]);
 * ```
 */
export function useChannelMerge(
  inputs: Signal[],
  options?: ChannelMergeOptions,
): Signal;

/**
 * useChannelMerge — legacy 2-argument overload for stereo merging.
 *
 * @deprecated Use the array form: `useChannelMerge([left, right])`
 */
export function useChannelMerge(left: Signal, right: Signal): Signal;

export function useChannelMerge(
  inputsOrLeft: Signal[] | Signal,
  optionsOrRight?: ChannelMergeOptions | Signal,
): Signal {
  // Handle legacy 2-arg overload: useChannelMerge(left, right)
  let inputs: Signal[];
  let layout: ChannelLayoutOrCustom;

  if (Array.isArray(inputsOrLeft)) {
    inputs = inputsOrLeft;
    layout = (optionsOrRight as ChannelMergeOptions | undefined)?.layout ?? "stereo";
  } else {
    // Legacy form: (left: Signal, right: Signal)
    inputs = [inputsOrLeft, optionsOrRight as Signal];
    layout = "stereo";
  }

  const count = channelCount(layout);

  return useAudioNode(
    "merge",
    { bypass: false, __channelCount: count },
    inputs,
  );
}
