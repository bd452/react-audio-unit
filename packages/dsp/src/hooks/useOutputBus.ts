import { useContext } from "react";
import type { Signal } from "@react-audio-unit/core";
import {
  IOConfigContext,
  useAudioGraphContext,
  channelCount,
  type ChannelLayoutOrCustom,
} from "@react-audio-unit/core";

/**
 * Information about an active audio output bus.
 */
export interface OutputBusInfo {
  /** The active channel layout negotiated with the host. */
  layout: ChannelLayoutOrCustom;
  /** Number of audio channels in this bus. */
  channels: number;
  /** Whether this bus is currently active. */
  active: boolean;
  /** The bus name from the plugin config. */
  name: string;
}

/**
 * useOutputBus — designates a signal as the plugin's audio output for a
 * specific bus.
 *
 * This is the bus-aware replacement for `useOutput()`. It also returns
 * information about the active output layout so the plugin can adapt
 * its processing chain accordingly (e.g. upmix mono to stereo, or
 * generate surround content for 5.1).
 *
 * @param signal   - The audio signal to send to this output bus.
 * @param busIndex - Index into the plugin's `io.audio.outputs` array (default 0 = main output).
 * @returns Output bus information including the active layout.
 *
 * @example
 * ```tsx
 * // Simple usage — same as useOutput but returns layout info
 * const outInfo = useOutputBus(processedSignal);
 * console.log(outInfo.layout); // "stereo"
 *
 * // Adaptive processing based on output format
 * const outInfo = useOutputBus(signal, 0);
 * if (outInfo.layout === "surround-5.1") {
 *   // Could use this info to adjust processing
 * }
 * ```
 */
export function useOutputBus(signal: Signal, busIndex = 0): OutputBusInfo {
  const ctx = useAudioGraphContext();
  const ioConfig = useContext(IOConfigContext);
  const busInfo = ioConfig.audio.outputs[busIndex];

  const layout = busInfo?.layout ?? "stereo";
  const active = busInfo?.active ?? true;
  const name = busInfo?.name ?? `Output ${busIndex}`;
  const channels = channelCount(layout);

  // Set this signal as the output for the given bus.
  // For bus 0 this is identical to the old useOutput behavior.
  // Multi-bus output support will use a bus-indexed setOutput in the future.
  ctx.setOutputNode(signal.nodeId);

  return { layout, channels, active, name };
}
