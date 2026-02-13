import { useContext, useCallback } from "react";
import type { MidiEvent } from "@react-audio-unit/core";
import {
  IOConfigContext,
  useAudioGraphContext,
} from "@react-audio-unit/core";

/**
 * Information about a MIDI output bus.
 */
export interface MidiOutputBusResult {
  /**
   * Send MIDI events to the host via this output bus.
   * Useful for MIDI effects, arpeggiators, sequencers, etc.
   */
  send: (events: MidiEvent[]) => void;
  /** Number of MIDI channels on this bus (1–16). */
  channels: number;
  /** Whether this MIDI bus is active. */
  active: boolean;
  /** The bus name from the plugin config. */
  name: string;
}

/**
 * useMidiOutput — provides a named MIDI output bus.
 *
 * Allows a plugin to send MIDI events to the host (e.g. for MIDI effects,
 * arpeggiators, or step sequencers that generate MIDI output).
 *
 * @param busIndex - Index into the plugin's `io.midi.outputs` array (default 0).
 * @returns MIDI output bus with a `send` function and bus metadata.
 *
 * @example
 * ```tsx
 * const midiOut = useMidiOutput();
 * // Send a note from a step sequencer
 * midiOut.send([{ type: "noteOn", channel: 0, note: 60, velocity: 100 }]);
 * ```
 */
export function useMidiOutput(busIndex = 0): MidiOutputBusResult {
  const ioConfig = useContext(IOConfigContext);
  const ctx = useAudioGraphContext();

  const busInfo = ioConfig.midi.outputs[busIndex];
  const channels = busInfo?.channels ?? 16;
  const active = busInfo?.active ?? true;
  const name = busInfo?.name ?? `MIDI Out ${busIndex}`;

  const send = useCallback(
    (events: MidiEvent[]) => {
      if (!active || events.length === 0) return;
      // Send MIDI output events via the bridge
      ctx.bridge.send({
        type: "graphOps",
        ops: [
          {
            op: "addNode",
            nodeId: `__midi_out_${busIndex}`,
            nodeType: "midi_output",
            params: {
              __midiBus: busIndex,
              __events: JSON.stringify(events),
            },
          },
        ],
      });
    },
    [active, busIndex, ctx.bridge],
  );

  return { send, channels, active, name };
}
