/**
 * Channel Strip — EQ + Compressor + Gate + Gain.
 *
 * Demonstrates:
 * - Complex signal chain with multiple processing stages
 * - Compressor with threshold/ratio/attack/release
 * - High-pass filter as a "gate" (removes rumble)
 * - Input/output metering
 * - Multiple panels and parameter groups
 */
import {
  useInput,
  useOutput,
  useParameter,
  useFilter,
  useCompressor,
  useGain,
  useMeter,
} from "@react-audio-unit/dsp";
import { Knob, Panel, Toggle, Meter } from "@react-audio-unit/ui";

export default function Plugin() {
  const input = useInput();

  // --- High Pass Filter (gate/rumble removal) ---
  const [hpOn, setHpOn] = useParameter("hp_on", {
    default: 1,
    min: 0,
    max: 1,
    label: "HP On",
  });
  const [hpFreq, setHpFreq] = useParameter("hp_freq", {
    default: 80,
    min: 20,
    max: 500,
    label: "HP Freq",
    curve: "logarithmic",
  });

  // --- EQ (3-band) ---
  const [lowGain, setLowGain] = useParameter("eq_low", {
    default: 0,
    min: -12,
    max: 12,
    label: "Low",
  });
  const [midGain, setMidGain] = useParameter("eq_mid", {
    default: 0,
    min: -12,
    max: 12,
    label: "Mid",
  });
  const [midFreq, setMidFreq] = useParameter("eq_mid_freq", {
    default: 1000,
    min: 200,
    max: 8000,
    label: "Mid Freq",
    curve: "logarithmic",
  });
  const [highGain, setHighGain] = useParameter("eq_high", {
    default: 0,
    min: -12,
    max: 12,
    label: "High",
  });

  // --- Compressor ---
  const [threshold, setThreshold] = useParameter("comp_thresh", {
    default: -12,
    min: -60,
    max: 0,
    label: "Threshold",
  });
  const [ratio, setRatio] = useParameter("comp_ratio", {
    default: 4,
    min: 1,
    max: 20,
    label: "Ratio",
  });
  const [compAttack, setCompAttack] = useParameter("comp_attack", {
    default: 10,
    min: 0.1,
    max: 100,
    label: "Attack",
    curve: "logarithmic",
  });
  const [compRelease, setCompRelease] = useParameter("comp_release", {
    default: 100,
    min: 10,
    max: 1000,
    label: "Release",
    curve: "logarithmic",
  });
  const [makeup, setMakeup] = useParameter("comp_makeup", {
    default: 0,
    min: 0,
    max: 24,
    label: "Makeup",
  });

  // --- Output ---
  const [outGain, setOutGain] = useParameter("output", {
    default: 1.0,
    min: 0,
    max: 2,
    label: "Output",
  });

  // Signal chain
  const inputMeter = useMeter(input);

  // HP filter — use bypass instead of conditional hook (Rules of Hooks)
  const afterHP = useFilter(input, {
    type: "highpass",
    cutoff: hpFreq,
    resonance: 0.707,
    bypass: hpOn <= 0.5,
  });

  // 3-band EQ
  const afterLow = useFilter(afterHP, {
    type: "lowshelf",
    cutoff: 200,
    gainDb: lowGain,
    resonance: 0.707,
  });
  const afterMid = useFilter(afterLow, {
    type: "peaking",
    cutoff: midFreq,
    gainDb: midGain,
    resonance: 1.5,
  });
  const afterHigh = useFilter(afterMid, {
    type: "highshelf",
    cutoff: 6000,
    gainDb: highGain,
    resonance: 0.707,
  });

  // Compressor (attack/release are already in ms — no conversion needed)
  const afterComp = useCompressor(afterHigh, {
    threshold,
    ratio,
    attack: compAttack,
    release: compRelease,
    makeupDb: makeup,
  });

  // Output gain
  const final = useGain(afterComp, { gain: outGain });
  const outputMeter = useMeter(final);

  useOutput(final);

  return (
    <div style={{ display: "flex", height: "100%", gap: 8, padding: 12 }}>
      {/* Input meter */}
      <Panel title="In" direction="column" gap={4}>
        <Meter levels={inputMeter} height={300} label="Input" />
      </Panel>

      {/* HP Filter */}
      <Panel title="HP Filter" direction="column" gap={8}>
        <Toggle
          label="On"
          value={hpOn > 0.5}
          onChange={(v: boolean) => setHpOn(v ? 1 : 0)}
        />
        <Knob
          label="Freq"
          value={hpFreq}
          min={20}
          max={500}
          onChange={setHpFreq}
        />
      </Panel>

      {/* EQ */}
      <Panel title="EQ" direction="column" gap={8}>
        <Knob
          label="Low"
          value={lowGain}
          min={-12}
          max={12}
          onChange={setLowGain}
        />
        <Knob
          label="Mid"
          value={midGain}
          min={-12}
          max={12}
          onChange={setMidGain}
        />
        <Knob
          label="Mid Freq"
          value={midFreq}
          min={200}
          max={8000}
          onChange={setMidFreq}
        />
        <Knob
          label="High"
          value={highGain}
          min={-12}
          max={12}
          onChange={setHighGain}
        />
      </Panel>

      {/* Compressor */}
      <Panel title="Compressor" direction="column" gap={8}>
        <Knob
          label="Threshold"
          value={threshold}
          min={-60}
          max={0}
          onChange={setThreshold}
        />
        <Knob
          label="Ratio"
          value={ratio}
          min={1}
          max={20}
          onChange={setRatio}
        />
        <Knob
          label="Attack"
          value={compAttack}
          min={0.1}
          max={100}
          onChange={setCompAttack}
        />
        <Knob
          label="Release"
          value={compRelease}
          min={10}
          max={1000}
          onChange={setCompRelease}
        />
        <Knob
          label="Makeup"
          value={makeup}
          min={0}
          max={24}
          onChange={setMakeup}
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
        <Meter levels={outputMeter} height={200} label="Output" />
      </Panel>
    </div>
  );
}
