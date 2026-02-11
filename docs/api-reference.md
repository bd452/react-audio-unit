# API Reference

## DSP Hooks

All hooks are exported from `@react-audio-unit/dsp`.

### I/O

#### `useInput(channel?: number): Signal`
Returns the DAW audio input as a Signal. The optional `channel` parameter selects the input bus (default `0`).

#### `useOutput(signal: Signal): void`
Designates a signal as the plugin's audio output. Must be called exactly once per render.

---

### Parameters

#### `useParameter(id: string, config: ParameterConfig): [number, (value: number) => void]`
Registers a DAW-automatable parameter and returns a `[value, setter]` tuple.

**ParameterConfig:**
| Field | Type | Description |
|-------|------|-------------|
| `default` | `number` | Default value |
| `min` | `number` | Minimum value |
| `max` | `number` | Maximum value |
| `label` | `string` | Display label |
| `unit` | `string?` | Unit suffix (e.g. "dB", "Hz", "ms") |
| `curve` | `"linear" \| "logarithmic" \| "exponential"?` | Parameter curve for knob mapping |
| `steps` | `number?` | Number of discrete steps (for stepped parameters) |

---

### Effects

#### `useGain(input: Signal, params: GainParams): Signal`
Applies gain to the input signal.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `gain` | `number` | — | Linear gain (0–1+) |
| `gainDb` | `number?` | — | Gain in decibels (alternative to `gain`) |
| `bypass` | `boolean?` | `false` | Bypass processing |

#### `useDelay(input: Signal, params: DelayParams): Signal`
Delay line with feedback.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `time` | `number` | — | Delay time in ms |
| `feedback` | `number?` | `0` | Feedback amount (0–1) |
| `mix` | `number?` | `1` | Dry/wet mix |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useFilter(input: Signal, params: FilterParams): Signal`
Biquad filter with multiple types.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `FilterType` | — | `"lowpass"`, `"highpass"`, `"bandpass"`, `"notch"`, `"allpass"`, `"lowshelf"`, `"highshelf"`, `"peak"` |
| `cutoff` | `number` | — | Cutoff/center frequency in Hz |
| `resonance` | `number?` | `0.707` | Resonance (Q factor) |
| `gainDb` | `number?` | `0` | Gain for shelf/peak filters |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useCompressor(input: Signal, params: CompressorParams, sidechain?: Signal): Signal`
Dynamics compressor with optional sidechain.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `threshold` | `number` | — | Threshold in dB |
| `ratio` | `number` | — | Compression ratio |
| `attack` | `number` | — | Attack time in ms |
| `release` | `number` | — | Release time in ms |
| `knee` | `number?` | `0` | Soft knee width in dB |
| `makeupDb` | `number?` | `0` | Makeup gain in dB |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useReverb(input: Signal, params: ReverbParams): Signal`
Algorithmic reverb (Freeverb).

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `roomSize` | `number` | — | Room size (0–1) |
| `damping` | `number` | — | Damping (0–1) |
| `mix` | `number` | — | Dry/wet mix (0–1) |
| `preDelay` | `number?` | `0` | Pre-delay in ms |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useDistortion(input: Signal, params: DistortionParams): Signal`
Waveshaper with multiple curves.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `DistortionType` | — | `"soft"`, `"hard"`, `"tanh"`, `"atan"`, `"foldback"` |
| `drive` | `number` | — | Drive amount |
| `outputLevel` | `number?` | `1` | Output level |
| `mix` | `number?` | `1` | Dry/wet mix |
| `bypass` | `boolean?` | `false` | Bypass |

#### `usePan(input: Signal, params: PanParams): Signal`
Stereo panner.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `pan` | `number` | — | Pan position (-1 left, 0 center, 1 right) |
| `law` | `"linear" \| "equalPower"?` | `"equalPower"` | Panning law |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useMix(a: Signal, b: Signal, mix: number): Signal`
Crossfade between two signals. `mix = 0` outputs 100% A, `mix = 1` outputs 100% B.

---

### Composite Effects

These are built from the primitive hooks above.

#### `useChorus(input: Signal, params?: ChorusParams): Signal`
Chorus effect using multiple offset delay lines.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `rate` | `number?` | `1.5` | LFO rate in Hz |
| `depth` | `number?` | `5` | Modulation depth in ms |
| `delayMs` | `number?` | `15` | Base delay in ms |
| `mix` | `number?` | `0.5` | Dry/wet mix |
| `voices` | `number?` | `2` | Number of voices (1–4) |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useFlanger(input: Signal, params?: FlangerParams): Signal`
Flanger from a short delay with feedback.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `rate` | `number?` | `0.5` | LFO rate in Hz |
| `depth` | `number?` | `2` | Modulation depth in ms |
| `delayMs` | `number?` | `3` | Base delay in ms |
| `feedback` | `number?` | `0.5` | Feedback (-0.95 to 0.95) |
| `mix` | `number?` | `0.5` | Dry/wet mix |
| `bypass` | `boolean?` | `false` | Bypass |

#### `usePhaser(input: Signal, params?: PhaserParams): Signal`
Phaser from cascaded allpass filters.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `rate` | `number?` | `0.5` | LFO rate in Hz |
| `depth` | `number?` | `0.7` | Sweep depth |
| `centerFreq` | `number?` | `1000` | Center frequency in Hz |
| `feedback` | `number?` | `0.5` | Feedback (0–0.95) |
| `stages` | `number?` | `4` | Number of allpass stages (2, 4, 6, 8) |
| `mix` | `number?` | `0.5` | Dry/wet mix |
| `bypass` | `boolean?` | `false` | Bypass |

---

### Generators

#### `useOscillator(params: OscillatorParams): Signal`
#### `useOscillator(midi: Signal | null, params: OscillatorParams): Signal`
Oscillator — fixed frequency or MIDI-driven.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `waveform` | `"sine" \| "saw" \| "square" \| "triangle"` | — | Waveform shape |
| `frequency` | `number?` | `440` | Frequency in Hz (ignored when MIDI-driven) |
| `detune` | `number?` | `0` | Detune in cents |
| `unison` | `number?` | `1` | Unison voices |
| `bypass` | `boolean?` | `false` | Bypass |

#### `useLFO(params: LFOParams): Signal`
Low-frequency oscillator for modulation.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `rate` | `number` | — | Rate in Hz |
| `shape` | `LFOShape` | — | `"sine"`, `"triangle"`, `"saw"`, `"square"`, `"random"` |
| `depth` | `number?` | `1` | Depth/amplitude (0–1) |
| `phase` | `number?` | `0` | Phase offset in degrees |
| `tempoSync` | `boolean?` | `false` | Sync to host tempo |

#### `useEnvelope(params: EnvelopeParams): Signal`
#### `useEnvelope(gate: Signal, params: EnvelopeParams): Signal`
ADSR envelope generator. Can be triggered by a parameter or a gate signal input.

| Param | Type | Description |
|-------|------|-------------|
| `attack` | `number` | Attack time in ms |
| `decay` | `number` | Decay time in ms |
| `sustain` | `number` | Sustain level (0–1) |
| `release` | `number` | Release time in ms |

---

### Analysis

#### `useMeter(input: Signal, typeOrOptions?: MeterType | MeterOptions, refreshRate?: number): MeterData`
Level metering. Passes audio through unchanged, reports levels to JS.

**MeterData:**
| Field | Type | Description |
|-------|------|-------------|
| `rms` | `number[]` | RMS level per channel |
| `peak` | `number[]` | Peak level per channel |

**MeterType:** `"peak" | "rms" | "both"`

#### `useSpectrum(input: Signal, fftSize?: number, refreshRate?: number): SpectrumData`
FFT spectrum analysis. Passes audio through unchanged.

**SpectrumData:**
| Field | Type | Description |
|-------|------|-------------|
| `magnitudes` | `number[]` | Frequency bin magnitudes |

---

### MIDI & Transport

#### `useMidi(): Signal`
Returns the DAW MIDI input as a Signal for instrument plugins.

#### `useTransport(): TransportState`
Access DAW transport state.

| Field | Type | Description |
|-------|------|-------------|
| `playing` | `boolean` | Whether playback is active |
| `bpm` | `number` | Current tempo |
| `positionSamples` | `number` | Playhead position in samples |
| `timeSigNum` | `number` | Time signature numerator |
| `timeSigDen` | `number` | Time signature denominator |

#### `useHostInfo(): HostInfo`
Access host audio configuration.

| Field | Type | Description |
|-------|------|-------------|
| `sampleRate` | `number` | Sample rate in Hz |
| `blockSize` | `number` | Buffer size in samples |

---

## UI Components

All components are exported from `@react-audio-unit/ui`.

### Controls

#### `<Knob>`
Rotary control for numeric values.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Current value |
| `min` | `number` | — | Minimum value |
| `max` | `number` | — | Maximum value |
| `onChange` | `(value: number) => void` | — | Change callback |
| `label` | `string?` | — | Display label |
| `unit` | `string?` | — | Unit suffix |
| `size` | `number?` | `64` | Diameter in pixels |
| `steps` | `number?` | — | Discrete steps |

#### `<Slider>`
Linear slider for numeric values.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Current value |
| `min` | `number` | — | Minimum |
| `max` | `number` | — | Maximum |
| `onChange` | `(value: number) => void` | — | Change callback |
| `label` | `string?` | — | Label |
| `unit` | `string?` | — | Unit |
| `orientation` | `"horizontal" \| "vertical"?` | `"horizontal"` | Direction |
| `width` | `number?` | — | Width in px |
| `height` | `number?` | — | Height in px |

#### `<Toggle>`
Boolean toggle switch.

| Prop | Type | Description |
|------|------|-------------|
| `value` | `boolean` | Current state |
| `onChange` | `(value: boolean) => void` | Change callback |
| `label` | `string?` | Label |

#### `<Select>`
Dropdown selector.

| Prop | Type | Description |
|------|------|-------------|
| `options` | `string[] \| SelectOption[]` | Options list |
| `value` | `string \| number` | Selected value |
| `onChange` | `(value: string) => void` | Change callback |
| `label` | `string?` | Label |

**SelectOption:** `{ value: string, label: string }`

#### `<XYPad>`
Two-dimensional control surface.

| Prop | Type | Description |
|------|------|-------------|
| `x` | `number` | X value |
| `y` | `number` | Y value |
| `onChangeX` | `(value: number) => void` | X change callback |
| `onChangeY` | `(value: number) => void` | Y change callback |
| `minX`, `maxX` | `number?` | X range |
| `minY`, `maxY` | `number?` | Y range |
| `size` | `number?` | Size in px |
| `label` | `string?` | Label |

#### `<Keyboard>`
On-screen MIDI keyboard.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `startNote` | `number?` | `48` | Starting MIDI note |
| `numKeys` | `number?` | `25` | Number of keys |
| `onNoteOn` | `(note, velocity) => void?` | — | Note on callback |
| `onNoteOff` | `(note) => void?` | — | Note off callback |
| `activeNotes` | `Set<number>?` | — | Currently active notes |
| `width` | `number?` | — | Width in px |
| `height` | `number?` | — | Height in px |

---

### Visualization

#### `<Meter>`
Level meter display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `levels` | `MeterLevels` | — | `{ rms: number[], peak: number[] }` |
| `orientation` | `"vertical" \| "horizontal"?` | `"vertical"` | Direction |
| `width` | `number?` | — | Width in px |
| `height` | `number?` | — | Height in px |
| `label` | `string?` | — | Label below meter |

#### `<Waveform>`
Time-domain waveform display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `number[]` | — | Sample data |
| `width` | `number?` | `200` | Width in px |
| `height` | `number?` | `100` | Height in px |
| `color` | `string?` | `"#4fc3f7"` | Line color |
| `backgroundColor` | `string?` | `"transparent"` | Background |
| `lineWidth` | `number?` | `2` | Line width |
| `fill` | `boolean?` | `false` | Fill below line |

#### `<Spectrum>`
Frequency spectrum bar graph.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `magnitudes` | `number[]` | — | FFT magnitude data |
| `width` | `number?` | `400` | Width in px |
| `height` | `number?` | `200` | Height in px |
| `bars` | `number?` | `64` | Number of bars |
| `barGap` | `number?` | `1` | Gap between bars |
| `logScale` | `boolean?` | `true` | Use logarithmic frequency scale |

---

### Layout

#### `<Panel>`
Container component with optional title and flex layout.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string?` | — | Section title |
| `direction` | `"row" \| "column"?` | `"row"` | Flex direction |
| `gap` | `number?` | `8` | Gap between children in px |
| `className` | `string?` | — | Additional CSS class |
| `children` | `ReactNode` | — | Content |

#### `<PresetBrowser>`
Preset management UI.

| Prop | Type | Description |
|------|------|-------------|
| `presets` | `Preset[]` | Available presets |
| `selectedIndex` | `number?` | Currently selected index |
| `onSelect` | `(preset, index) => void` | Selection callback |
| `onSave` | `(name: string) => void?` | Save callback |
| `onDelete` | `(index: number) => void?` | Delete callback |

**Preset:** `{ name: string, data: Record<string, number> }`

---

## Themes

Import a theme CSS file to style all components:

```tsx
import "@react-audio-unit/ui/themes/dark.css";
// or
import "@react-audio-unit/ui/themes/light.css";
```

Themes define CSS custom properties that control colors, backgrounds, borders, and fonts for all UI components.

---

## Core

### `<PluginHost>`
Top-level provider that must wrap your plugin component. Provides the audio graph context, bridge connection, and reconciliation loop.

```tsx
import { PluginHost } from "@react-audio-unit/core";

createRoot(document.getElementById("root")!).render(
  <PluginHost>
    <MyPlugin />
  </PluginHost>
);
```

### `NativeBridge`
The bridge handles communication between JavaScript and the native C++ engine. You don't normally interact with it directly — the hooks handle this. It's available via `bridge` export from `@react-audio-unit/core`.
