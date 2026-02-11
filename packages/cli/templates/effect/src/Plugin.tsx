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
    default: 1,
    min: 0,
    max: 2,
    label: "Gain",
  });

  const output = useGain(input, { gain });
  useOutput(output);

  return (
    <Panel title="My Plugin">
      <Knob label="Gain" value={gain} min={0} max={2} onChange={setGain} />
    </Panel>
  );
}
