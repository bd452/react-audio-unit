import { useContext, useMemo } from "react";
import type { Signal, MidiEvent } from "@react-audio-unit/core";
import { IOConfigContext, MidiContext } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * Information about a MIDI input bus.
 */
export interface MidiInputBusResult {
  /**
   * A Signal handle representing this MIDI input in the audio graph.
   * Pass this to instrument nodes (useOscillator, useEnvelope, etc.)
   * to drive them from MIDI data.
   */
  signal: Signal;
  /** The current block's MIDI events for this bus. */
  events: MidiEvent[];
  /** Number of MIDI channels on this bus (1–16). */
  channels: number;
  /** Whether this MIDI bus is active. */
  active: boolean;
  /** The bus name from the plugin config. */
  name: string;
}

/**
 * useMidiInput — provides a named MIDI input bus.
 *
 * This is the bus-aware MIDI input hook. Audio and MIDI are handled as
 * separate bus types, following the VST3/AU/AAX model where MIDI (event)
 * buses are independent of audio buses.
 *
 * The returned `signal` is a graph-level handle for connecting MIDI-driven
 * nodes. The `events` array gives access to the raw MIDI events for the
 * current processing block (useful for custom MIDI handling in the UI).
 *
 * @param busIndex - Index into the plugin's `io.midi.inputs` array (default 0).
 * @returns MIDI bus information including signal, events, and channel count.
 *
 * @example
 * ```tsx
 * // Basic MIDI input for an instrument
 * const midi = useMidiInput();
 * const osc = useOscillator(midi.signal, { waveform: "saw" });
 *
 * // Multiple MIDI buses
 * const mainMidi = useMidiInput(0);
 * const auxMidi  = useMidiInput(1);
 * ```
 */
export function useMidiInput(busIndex = 0): MidiInputBusResult {
  const ioConfig = useContext(IOConfigContext);
  const midiBusEvents = useContext(MidiContext);

  const busInfo = ioConfig.midi.inputs[busIndex];
  const channels = busInfo?.channels ?? 16;
  const active = busInfo?.active ?? true;
  const name = busInfo?.name ?? `MIDI In ${busIndex}`;

  // Register a midi_input node in the graph for this bus
  const signal = useAudioNode("midi_input", {
    __midiBus: busIndex,
    __midiChannels: channels,
  });

  // Get events for this specific bus
  const events = midiBusEvents.get(busIndex) ?? [];

  return useMemo(
    () => ({ signal, events, channels, active, name }),
    [signal, events, channels, active, name],
  );
}
