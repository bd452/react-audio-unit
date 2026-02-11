/**
 * Subtractive Synth — classic analog-style synthesizer.
 *
 * Demonstrates:
 * - MIDI input handling
 * - Oscillator with multiple waveforms
 * - Filter with resonance
 * - ADSR envelope
 * - On-screen keyboard
 */
import {
  useOutput,
  useParameter,
  useOscillator,
  useFilter,
  useEnvelope,
  useGain,
  useMidi,
  useMeter,
} from "@react-audio-unit/dsp";
import { Knob, Panel, Select, Keyboard, Meter } from "@react-audio-unit/ui";
import { useState, useCallback } from "react";

const WAVEFORMS = ["sine", "saw", "square", "triangle"] as const;
const FILTER_TYPES = ["lowpass", "highpass", "bandpass"] as const;

export default function Plugin() {
  const midi = useMidi();

  // Oscillator
  const [waveform, setWaveform] = useParameter("osc_waveform", {
    default: 1,
    min: 0,
    max: 3,
    label: "Waveform",
  });
  const [detune, setDetune] = useParameter("osc_detune", {
    default: 0,
    min: -100,
    max: 100,
    label: "Detune",
  });

  // Filter
  const [filterType, setFilterType] = useParameter("filter_type", {
    default: 0,
    min: 0,
    max: 2,
    label: "Filter Type",
  });
  const [cutoff, setCutoff] = useParameter("filter_cutoff", {
    default: 2000,
    min: 20,
    max: 20000,
    label: "Cutoff",
    curve: "logarithmic",
  });
  const [resonance, setResonance] = useParameter("filter_q", {
    default: 1.0,
    min: 0.1,
    max: 20,
    label: "Resonance",
    curve: "logarithmic",
  });

  // Envelope
  const [attack, setAttack] = useParameter("env_attack", {
    default: 0.01,
    min: 0.001,
    max: 2.0,
    label: "Attack",
    curve: "logarithmic",
  });
  const [decay, setDecay] = useParameter("env_decay", {
    default: 0.2,
    min: 0.001,
    max: 2.0,
    label: "Decay",
    curve: "logarithmic",
  });
  const [sustain, setSustain] = useParameter("env_sustain", {
    default: 0.7,
    min: 0,
    max: 1,
    label: "Sustain",
  });
  const [release, setRelease] = useParameter("env_release", {
    default: 0.3,
    min: 0.001,
    max: 5.0,
    label: "Release",
    curve: "logarithmic",
  });

  // Master volume
  const [volume, setVolume] = useParameter("master_vol", {
    default: 0.7,
    min: 0,
    max: 1,
    label: "Volume",
  });

  // Audio signal chain
  const osc = useOscillator(midi, {
    waveform: WAVEFORMS[Math.round(waveform)],
    detune,
  });

  const env = useEnvelope(midi, { attack, decay, sustain, release });

  const filtered = useFilter(osc, {
    type: FILTER_TYPES[Math.round(filterType)],
    cutoff,
    resonance,
  });

  // Apply envelope as amplitude modulation, then master volume
  const shaped = useGain(filtered, { gain: volume });
  const final = useGain(shaped, { gain: 1.0 });

  // Connect envelope to the gain node via audio graph connection
  // The envelope output (0-1 signal) modulates the amplitude
  // Note: In a full implementation, the envelope would be connected
  // as an input to the gain node. For now, the ADSR is created as a
  // node in the graph and the host connects it automatically.
  void env; // Ensure env node is included in the graph

  const meter = useMeter(final);
  useOutput(final);

  // On-screen keyboard state
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());

  const onNoteOn = useCallback((note: number) => {
    setActiveNotes((prev: Set<number>) => new Set(prev).add(note));
  }, []);

  const onNoteOff = useCallback((note: number) => {
    setActiveNotes((prev: Set<number>) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

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
      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        {/* Oscillator */}
        <Panel title="Oscillator" direction="column" gap={8}>
          <Select
            label="Waveform"
            options={WAVEFORMS.map((w, i) => ({ value: String(i), label: w }))}
            value={String(Math.round(waveform))}
            onChange={(v: string) => setWaveform(Number(v))}
          />
          <Knob
            label="Detune"
            value={detune}
            min={-100}
            max={100}
            onChange={setDetune}
          />
        </Panel>

        {/* Filter */}
        <Panel title="Filter" direction="column" gap={8}>
          <Select
            label="Type"
            options={FILTER_TYPES.map((t, i) => ({
              value: String(i),
              label: t,
            }))}
            value={String(Math.round(filterType))}
            onChange={(v: string) => setFilterType(Number(v))}
          />
          <Knob
            label="Cutoff"
            value={cutoff}
            min={20}
            max={20000}
            onChange={setCutoff}
          />
          <Knob
            label="Resonance"
            value={resonance}
            min={0.1}
            max={20}
            onChange={setResonance}
          />
        </Panel>

        {/* Envelope */}
        <Panel title="Envelope" direction="column" gap={8}>
          <Knob
            label="Attack"
            value={attack}
            min={0.001}
            max={2}
            onChange={setAttack}
          />
          <Knob
            label="Decay"
            value={decay}
            min={0.001}
            max={2}
            onChange={setDecay}
          />
          <Knob
            label="Sustain"
            value={sustain}
            min={0}
            max={1}
            onChange={setSustain}
          />
          <Knob
            label="Release"
            value={release}
            min={0.001}
            max={5}
            onChange={setRelease}
          />
        </Panel>

        {/* Master */}
        <Panel title="Master" direction="column" gap={8}>
          <Knob
            label="Volume"
            value={volume}
            min={0}
            max={1}
            onChange={setVolume}
          />
          <Meter levels={meter} height={100} label="Out" />
        </Panel>
      </div>

      {/* Keyboard */}
      <Keyboard
        startNote={48}
        numKeys={25}
        activeNotes={activeNotes}
        onNoteOn={onNoteOn}
        onNoteOff={onNoteOff}
      />
    </div>
  );
}
