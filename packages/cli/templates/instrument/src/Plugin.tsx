import {
  useOutput,
  useParameter,
  useOscillator,
  useFilter,
  useGain,
  useEnvelope,
  useMidi,
} from "@react-audio-unit/dsp";
import { Knob, Panel, Select } from "@react-audio-unit/ui";

export default function Plugin() {
  const midi = useMidi();

  const [waveform, setWaveform] = useParameter("waveform", {
    default: 0,
    min: 0,
    max: 3,
    label: "Waveform",
    steps: 4,
  });

  const [cutoff, setCutoff] = useParameter("cutoff", {
    default: 2000,
    min: 20,
    max: 20000,
    label: "Cutoff",
    unit: "Hz",
    curve: "logarithmic",
  });

  const [resonance, setResonance] = useParameter("resonance", {
    default: 0.707,
    min: 0.1,
    max: 10,
    label: "Resonance",
  });

  const [attack, setAttack] = useParameter("attack", {
    default: 10,
    min: 1,
    max: 5000,
    label: "Attack",
    unit: "ms",
  });

  const [release, setRelease] = useParameter("release", {
    default: 200,
    min: 1,
    max: 5000,
    label: "Release",
    unit: "ms",
  });

  const [volume, setVolume] = useParameter("volume", {
    default: 0.8,
    min: 0,
    max: 1,
    label: "Volume",
  });

  const waveformNames = ["sine", "saw", "square", "triangle"] as const;

  // Audio signal chain
  const osc = useOscillator({
    waveform: waveformNames[waveform] ?? "saw",
    frequency: 440,
  });

  const env = useEnvelope({
    attack,
    decay: 100,
    sustain: 0.7,
    release,
  });

  const filtered = useFilter(osc, {
    type: "lowpass",
    cutoff,
    resonance,
  });

  const output = useGain(filtered, { gain: volume });
  useOutput(output);

  return (
    <Panel title="{{PLUGIN_NAME_PASCAL}} Synth">
      <Panel title="Oscillator" direction="row">
        <Select
          label="Waveform"
          value={String(waveform)}
          options={[
            { value: "0", label: "Sine" },
            { value: "1", label: "Saw" },
            { value: "2", label: "Square" },
            { value: "3", label: "Triangle" },
          ]}
          onChange={(v) => setWaveform(Number(v))}
        />
      </Panel>
      <Panel title="Filter" direction="row">
        <Knob label="Cutoff" value={cutoff} min={20} max={20000} onChange={setCutoff} />
        <Knob label="Resonance" value={resonance} min={0.1} max={10} onChange={setResonance} />
      </Panel>
      <Panel title="Envelope" direction="row">
        <Knob label="Attack" value={attack} min={1} max={5000} onChange={setAttack} />
        <Knob label="Release" value={release} min={1} max={5000} onChange={setRelease} />
      </Panel>
      <Panel title="Output" direction="row">
        <Knob label="Volume" value={volume} min={0} max={1} onChange={setVolume} />
      </Panel>
    </Panel>
  );
}
