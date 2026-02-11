/**
 * Parametric EQ — 4-band parametric equalizer.
 *
 * Demonstrates:
 * - Chaining multiple filter nodes
 * - Logarithmic parameter curves for frequency
 * - Multiple parameter groups
 * - Spectrum analyzer display
 */
import {
  useInput,
  useOutput,
  useParameter,
  useFilter,
  useGain,
  useMeter,
  useSpectrum,
} from "@react-audio-unit/dsp";
import { Knob, Panel, Meter, Spectrum } from "@react-audio-unit/ui";

function EQBand({
  name,
  prefix,
  defaultFreq,
  defaultType,
}: {
  name: string;
  prefix: string;
  defaultFreq: number;
  defaultType: string;
}) {
  const [freq, setFreq] = useParameter(`${prefix}_freq`, {
    default: defaultFreq,
    min: 20,
    max: 20000,
    label: `${name} Freq`,
    curve: "logarithmic",
  });
  const [gain, setGain] = useParameter(`${prefix}_gain`, {
    default: 0,
    min: -18,
    max: 18,
    label: `${name} Gain`,
  });
  const [q, setQ] = useParameter(`${prefix}_q`, {
    default: 1.0,
    min: 0.1,
    max: 18,
    label: `${name} Q`,
    curve: "logarithmic",
  });

  return {
    freq,
    setFreq,
    gain,
    setGain,
    q,
    setQ,
    type: defaultType as "lowshelf" | "peaking" | "highshelf",
  };
}

export default function Plugin() {
  const input = useInput();

  // 4 EQ bands
  const lowShelf = EQBand({
    name: "Low",
    prefix: "low",
    defaultFreq: 100,
    defaultType: "lowshelf",
  });
  const lowMid = EQBand({
    name: "Low Mid",
    prefix: "lmid",
    defaultFreq: 500,
    defaultType: "peaking",
  });
  const highMid = EQBand({
    name: "High Mid",
    prefix: "hmid",
    defaultFreq: 2000,
    defaultType: "peaking",
  });
  const highShelf = EQBand({
    name: "High",
    prefix: "high",
    defaultFreq: 8000,
    defaultType: "highshelf",
  });

  // Output gain
  const [outGain, setOutGain] = useParameter("output_gain", {
    default: 1.0,
    min: 0,
    max: 2,
    label: "Output",
  });

  // Chain: input → low shelf → low mid → high mid → high shelf → gain → output
  const afterLow = useFilter(input, {
    type: lowShelf.type,
    cutoff: lowShelf.freq,
    gainDb: lowShelf.gain,
    resonance: lowShelf.q,
  });

  const afterLMid = useFilter(afterLow, {
    type: lowMid.type,
    cutoff: lowMid.freq,
    gainDb: lowMid.gain,
    resonance: lowMid.q,
  });

  const afterHMid = useFilter(afterLMid, {
    type: highMid.type,
    cutoff: highMid.freq,
    gainDb: highMid.gain,
    resonance: highMid.q,
  });

  const afterHigh = useFilter(afterHMid, {
    type: highShelf.type,
    cutoff: highShelf.freq,
    gainDb: highShelf.gain,
    resonance: highShelf.q,
  });

  const final = useGain(afterHigh, { gain: outGain });

  // Analysis
  const spectrum = useSpectrum(final);
  const meter = useMeter(final);

  useOutput(final);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 8,
        padding: 12,
      }}
    >
      {/* Spectrum display */}
      <Panel title="Parametric EQ">
        <Spectrum
          magnitudes={spectrum.magnitudes}
          width={660}
          height={150}
          logScale
        />
      </Panel>

      {/* EQ bands */}
      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        <Panel title="Low Shelf" direction="column" gap={8}>
          <Knob
            label="Freq"
            value={lowShelf.freq}
            min={20}
            max={20000}
            onChange={lowShelf.setFreq}
          />
          <Knob
            label="Gain"
            value={lowShelf.gain}
            min={-18}
            max={18}
            onChange={lowShelf.setGain}
          />
          <Knob
            label="Q"
            value={lowShelf.q}
            min={0.1}
            max={18}
            onChange={lowShelf.setQ}
          />
        </Panel>

        <Panel title="Low Mid" direction="column" gap={8}>
          <Knob
            label="Freq"
            value={lowMid.freq}
            min={20}
            max={20000}
            onChange={lowMid.setFreq}
          />
          <Knob
            label="Gain"
            value={lowMid.gain}
            min={-18}
            max={18}
            onChange={lowMid.setGain}
          />
          <Knob
            label="Q"
            value={lowMid.q}
            min={0.1}
            max={18}
            onChange={lowMid.setQ}
          />
        </Panel>

        <Panel title="High Mid" direction="column" gap={8}>
          <Knob
            label="Freq"
            value={highMid.freq}
            min={20}
            max={20000}
            onChange={highMid.setFreq}
          />
          <Knob
            label="Gain"
            value={highMid.gain}
            min={-18}
            max={18}
            onChange={highMid.setGain}
          />
          <Knob
            label="Q"
            value={highMid.q}
            min={0.1}
            max={18}
            onChange={highMid.setQ}
          />
        </Panel>

        <Panel title="High Shelf" direction="column" gap={8}>
          <Knob
            label="Freq"
            value={highShelf.freq}
            min={20}
            max={20000}
            onChange={highShelf.setFreq}
          />
          <Knob
            label="Gain"
            value={highShelf.gain}
            min={-18}
            max={18}
            onChange={highShelf.setGain}
          />
          <Knob
            label="Q"
            value={highShelf.q}
            min={0.1}
            max={18}
            onChange={highShelf.setQ}
          />
        </Panel>

        {/* Output */}
        <Panel title="Output" direction="column" gap={8}>
          <Knob
            label="Gain"
            value={outGain}
            min={0}
            max={2}
            onChange={setOutGain}
          />
          <Meter levels={meter} height={80} label="Out" />
        </Panel>
      </div>
    </div>
  );
}
