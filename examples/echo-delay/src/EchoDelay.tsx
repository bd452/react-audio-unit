import {
  useInput,
  useOutput,
  useParameter,
  useDelay,
  useFilter,
  useMix,
  useMeter,
} from "@react-audio-unit/dsp";
import { Knob, Meter, Panel, Toggle } from "@react-audio-unit/ui";

/**
 * Echo Delay — a stereo delay effect with filtered feedback.
 *
 * Demonstrates:
 *  - Multiple DSP hooks composing a signal chain
 *  - DAW-automatable parameters
 *  - Metering feedback from native audio engine
 *  - UI components bound to audio parameters
 */
export default function EchoDelay() {
  // Audio input from the DAW
  const input = useInput();

  // --- Parameters (exposed to DAW automation) ---
  const [time, setTime] = useParameter("time", {
    default: 375,
    min: 1,
    max: 2000,
    label: "Delay Time",
    unit: "ms",
  });

  const [feedback, setFeedback] = useParameter("feedback", {
    default: 0.35,
    min: 0,
    max: 0.95,
    label: "Feedback",
  });

  const [filterCutoff, setFilterCutoff] = useParameter("filterCutoff", {
    default: 4000,
    min: 200,
    max: 18000,
    label: "Tone",
    unit: "Hz",
    curve: "logarithmic",
  });

  const [mix, setMix] = useParameter("mix", {
    default: 0.4,
    min: 0,
    max: 1,
    label: "Mix",
  });

  const [filterOn, setFilterOn] = useParameter("filterOn", {
    default: 1,
    min: 0,
    max: 1,
    label: "Filter",
    steps: 2,
  });

  // --- Audio DSP Chain ---

  // Delay with feedback
  const delayed = useDelay(input, { time, feedback });

  // Low-pass filter on the delayed signal (for darker echoes)
  const filtered = useFilter(delayed, {
    type: "lowpass",
    cutoff: filterCutoff,
    resonance: 0.707,
    bypass: filterOn < 0.5,
  });

  // Mix dry and wet signals
  const output = useMix(input, filtered, mix);

  // Output to DAW
  useOutput(output);

  // Metering (sends analysis data back to JS for display)
  const meterData = useMeter(output);

  // --- UI ---

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Echo Delay</h1>
        <div style={styles.meterContainer}>
          <Meter levels={meterData} />
        </div>
      </div>

      <Panel>
        <div style={styles.controls}>
          <Knob
            label="Time"
            value={time}
            min={1}
            max={2000}
            onChange={setTime}
            unit="ms"
          />
          <Knob
            label="Feedback"
            value={feedback}
            min={0}
            max={0.95}
            onChange={setFeedback}
          />
          <Knob
            label="Tone"
            value={filterCutoff}
            min={200}
            max={18000}
            onChange={setFilterCutoff}
            unit="Hz"
          />
          <Knob label="Mix" value={mix} min={0} max={1} onChange={setMix} />
        </div>

        <div style={styles.toggleRow}>
          <Toggle
            label="Filter"
            value={filterOn > 0.5}
            onChange={(v) => setFilterOn(v ? 1 : 0)}
          />
        </div>
      </Panel>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    padding: "20px",
    gap: "16px",
    fontFamily: "var(--rau-font-family, Inter, -apple-system, sans-serif)",
    background: "var(--rau-bg, #1a1a2e)",
    color: "var(--rau-text, #e0e0e0)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 600,
    letterSpacing: "0.5px",
  },
  meterContainer: {
    width: "60px",
    height: "40px",
  },
  controls: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    padding: "20px 0",
    gap: "16px",
  },
  toggleRow: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "12px",
    borderTop: "1px solid var(--rau-border, #3a3a5c)",
  },
} as const;
