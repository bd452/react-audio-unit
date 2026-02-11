import {
  useInput,
  useOutput,
  useMeter,
  useSpectrum,
} from "@react-audio-unit/dsp";
import { Meter, Panel } from "@react-audio-unit/ui";

export default function Plugin() {
  const input = useInput();
  const meter = useMeter(input, { type: "both" });
  const spectrum = useSpectrum(input);

  // Pass audio through unchanged
  useOutput(input);

  return (
    <Panel title="{{PLUGIN_NAME_PASCAL}} Analyzer">
      <Panel title="Levels" direction="row">
        <Meter
          label="L"
          levels={{
            peak: [meter.peak?.[0] ?? 0],
            rms: [meter.rms?.[0] ?? 0],
          }}
        />
        <Meter
          label="R"
          levels={{
            peak: [meter.peak?.[1] ?? 0],
            rms: [meter.rms?.[1] ?? 0],
          }}
        />
      </Panel>
      <Panel title="Spectrum">
        <div
          style={{
            width: "100%",
            height: 200,
            background: "var(--rau-bg-secondary, #1a1a2e)",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-end",
            gap: 1,
            padding: "0 4px",
            overflow: "hidden",
          }}
        >
          {(spectrum.magnitudes ?? []).slice(0, 128).map((mag, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(1, mag * 100)}%`,
                background: `hsl(${200 + i * 0.5}, 70%, 60%)`,
                borderRadius: "2px 2px 0 0",
                transition: "height 50ms ease-out",
              }}
            />
          ))}
        </div>
      </Panel>
    </Panel>
  );
}
