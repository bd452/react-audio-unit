/**
 * Simple Gain — the "Hello World" of audio plugins.
 *
 * Demonstrates the minimal use of React Audio Unit:
 * - useInput / useOutput for audio I/O
 * - useParameter for DAW-automatable parameters
 * - useGain for a simple DSP node
 * - A Knob for the UI
 */
import {
  useInput,
  useOutput,
  useParameter,
  useGain,
} from "@react-audio-unit/dsp";
import { Knob, Panel } from "@react-audio-unit/ui";

export default function Plugin() {
  const input = useInput();

  const [gain, setGain] = useParameter("gain", {
    default: 1.0,
    min: 0,
    max: 2,
    label: "Gain",
  });

  const output = useGain(input, { gain });
  useOutput(output);

  return (
    <Panel title="Simple Gain">
      <Knob
        label="Gain"
        value={gain}
        min={0}
        max={2}
        steps={200}
        onChange={setGain}
      />
    </Panel>
  );
}
