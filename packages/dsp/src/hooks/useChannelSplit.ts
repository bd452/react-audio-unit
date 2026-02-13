import { useMemo } from "react";
import type { Signal } from "@react-audio-unit/core";
import {
  createSignal,
  channelCount,
  speakersFor,
  type ChannelLayoutOrCustom,
  type SpeakerLabel,
} from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * Result of splitting a multi-channel signal. Each channel is accessible
 * both by index and (for named layouts) by speaker label.
 */
export interface ChannelSplitResult {
  /** All channel signals, indexed by channel position (0-based). */
  channels: Signal[];
  /** Number of channels that were split out. */
  count: number;
  /**
   * Named accessors for standard speaker positions.
   * Only populated when splitting a named layout (e.g. stereo → L, R).
   */
  speakers: Partial<Record<SpeakerLabel, Signal>>;
  // Convenience accessors for common layouts
  /** Left channel (alias for speakers.L, outlet 0 for stereo). */
  left?: Signal;
  /** Right channel (alias for speakers.R, outlet 1 for stereo). */
  right?: Signal;
  /** Center channel (alias for speakers.C). */
  center?: Signal;
  /** LFE / sub channel (alias for speakers.LFE). */
  lfe?: Signal;
}

/**
 * useChannelSplit — splits a multi-channel signal into individual channel signals.
 *
 * Works with any channel layout, not just stereo. For a stereo signal it
 * returns `{ left, right }`; for surround-5.1 it returns all 6 channels
 * accessible by speaker label (`L`, `R`, `C`, `LFE`, `Ls`, `Rs`).
 *
 * The `layout` parameter tells the splitter how many channels to expect
 * and what speaker labels to assign. If omitted, defaults to "stereo"
 * for backward compatibility with the original stereo-only hook.
 *
 * @param input  - The multi-channel audio signal to split.
 * @param layout - The channel layout of the input signal (default: "stereo").
 * @returns Object with per-channel signals and named speaker accessors.
 *
 * @example
 * ```tsx
 * // Stereo split (backward compatible)
 * const { left, right } = useChannelSplit(input);
 *
 * // 5.1 surround split
 * const split = useChannelSplit(input, "surround-5.1");
 * const center = split.speakers.C;
 * const lfe = split.speakers.LFE;
 *
 * // Generic: iterate all channels
 * const split = useChannelSplit(input, layout);
 * split.channels.forEach((ch, i) => { ... });
 * ```
 */
export function useChannelSplit(
  input: Signal,
  layout: ChannelLayoutOrCustom = "stereo",
): ChannelSplitResult {
  const count = channelCount(layout);
  const speakerLabels = speakersFor(layout);

  // Register the split node — it produces `count` outlets
  const signal = useAudioNode(
    "split",
    { bypass: false, __channelCount: count },
    [input],
  );

  // Build per-channel signals (each outlet = one channel)
  const channels = useMemo(() => {
    const result: Signal[] = [signal]; // outlet 0 is the base signal
    for (let i = 1; i < count; i++) {
      result.push(createSignal(signal.nodeId, i));
    }
    return result;
  }, [signal, count]);

  // Build speaker label map
  const speakers = useMemo(() => {
    const map: Partial<Record<SpeakerLabel, Signal>> = {};
    speakerLabels.forEach((label, i) => {
      if (i < channels.length) {
        map[label] = channels[i];
      }
    });
    return map;
  }, [speakerLabels, channels]);

  return useMemo(
    () => ({
      channels,
      count,
      speakers,
      left: speakers.L,
      right: speakers.R,
      center: speakers.C,
      lfe: speakers.LFE,
    }),
    [channels, count, speakers],
  );
}
