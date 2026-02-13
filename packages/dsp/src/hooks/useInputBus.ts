import { useContext, useMemo } from "react";
import type { Signal } from "@react-audio-unit/core";
import {
  IOConfigContext,
  createSignal,
  channelCount,
  type ChannelLayoutOrCustom,
} from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import { PARAM_CHANNEL } from "../param-keys.js";

/**
 * Information about an active audio input bus, returned by `useInputBus`.
 */
export interface InputBusResult {
  /**
   * The audio signal for this bus — wire it into your DSP graph.
   * This is a multi-channel signal; the channel count depends on the
   * active layout (e.g. 2 for stereo, 6 for 5.1).
   */
  signal: Signal;
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
 * useInputBus — provides a named audio input bus from the DAW.
 *
 * This is the bus-aware replacement for `useInput()`. Where `useInput`
 * only supported a numeric bus index, `useInputBus` works with the
 * named bus declarations in `PluginIOConfig` and exposes the active
 * channel layout so downstream nodes can adapt their processing.
 *
 * @param busIndex - Index into the plugin's `io.audio.inputs` array (default 0 = main input).
 * @returns Bus information including the signal, active layout, and channel count.
 *
 * @example
 * ```tsx
 * // Main stereo/mono input (adapts to host negotiation)
 * const main = useInputBus(0);
 * console.log(main.layout); // "stereo" or "mono"
 *
 * // Optional sidechain
 * const sidechain = useInputBus(1);
 * if (sidechain.active) {
 *   // Use sidechain.signal in graph
 * }
 * ```
 */
export function useInputBus(busIndex = 0): InputBusResult {
  const ioConfig = useContext(IOConfigContext);
  const busInfo = ioConfig.audio.inputs[busIndex];

  // Derive layout info from the active config
  const layout = busInfo?.layout ?? "stereo";
  const active = busInfo?.active ?? true;
  const name = busInfo?.name ?? `Input ${busIndex}`;
  const channels = channelCount(layout);

  // Register the input node in the virtual graph
  const signal = useAudioNode("input", {
    [PARAM_CHANNEL]: busIndex,
    __busName: name,
    __channelCount: channels,
  });

  return useMemo(
    () => ({ signal, layout, channels, active, name }),
    [signal, layout, channels, active, name],
  );
}
