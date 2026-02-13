# Getting Started with React Audio Unit

Build professional AudioUnit and VST3 plugins using React and TypeScript.

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **CMake** >= 3.22 (`brew install cmake` on macOS)
- **C++ compiler** — Xcode Command Line Tools (macOS), MSVC (Windows), or GCC (Linux)
- JUCE is fetched automatically via CMake — no manual installation required.

## Quick Start

### 1. Create a new plugin project

```bash
npx @react-audio-unit/cli create my-plugin
cd my-plugin
```

You'll be prompted to choose a template:
- **effect** — a basic gain/effect plugin (stereo in/out)
- **instrument** — a synthesizer with oscillator, filter, and envelope
- **analyzer** — pass-through with metering and spectrum display

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start the development server

```bash
pnpm dev
```

This starts Vite with hot module replacement (HMR). Open [http://localhost:5173](http://localhost:5173) in your browser to see the plugin UI with a Web Audio mock bridge for basic audio preview.

To test inside a real plugin host:

```bash
pnpm dev -- --host
```

This builds and launches a standalone JUCE application that loads your plugin with the live Vite dev server.

### 4. Build for production

```bash
pnpm build
```

This:
1. Bundles the React UI with Vite
2. Compiles the C++ JUCE plugin with the UI embedded as binary data
3. Outputs AU, VST3, and/or Standalone binaries

### 5. Validate the build

```bash
pnpm validate
```

Runs platform-specific validation (e.g., `auval` on macOS).

---

## Project Structure

```
my-plugin/
├── plugin.config.ts     # Plugin metadata (name, vendor, formats, I/O)
├── src/
│   ├── main.tsx         # Entry point — renders PluginHost
│   └── Plugin.tsx       # Your plugin component (UI + DSP)
├── index.html           # Vite entry HTML
├── vite.config.ts       # Vite configuration
├── tsconfig.json
└── package.json
```

## Writing Your First Plugin

A React Audio Unit plugin is a React component that uses hooks to define both the UI and the audio signal flow:

```tsx
import { useInput, useOutput, useGain, useParameter } from "@react-audio-unit/dsp";
import { Knob, Panel } from "@react-audio-unit/ui";

export default function MyGain() {
  // Audio I/O
  const input = useInput();

  // Parameter synced with DAW automation
  const [gain, setGain] = useParameter("gain", {
    default: 0.5,
    min: 0,
    max: 1,
    label: "Gain",
  });

  // DSP node — applies gain to the input signal
  const processed = useGain(input, { gain });

  // Designate the output
  useOutput(processed);

  // UI
  return (
    <Panel title="My Gain" direction="column" gap={16}>
      <Knob
        value={gain}
        onChange={setGain}
        min={0}
        max={1}
        label="Gain"
      />
    </Panel>
  );
}
```

### Key Concepts

**Signals** — Opaque handles returned by DSP hooks (`useInput`, `useGain`, etc.). They represent connections in the audio graph, not actual sample data.

**DSP Hooks** — React hooks that register audio processing nodes. During each render, hooks build a virtual audio graph. After render, the reconciler diffs it against the previous graph and sends minimal updates to the native C++ engine.

**Parameters** — `useParameter` creates DAW-automatable parameters that sync bidirectionally between the UI and the host.

**UI Components** — Pre-built components (`Knob`, `Slider`, `Meter`, `Panel`, etc.) designed for plugin interfaces.

## Plugin Configuration

`plugin.config.ts` defines your plugin's metadata:

```ts
export default {
  name: "My Plugin",
  vendor: "My Company",
  vendorId: "MyCo",
  pluginId: "MyPl",
  version: "1.0.0",
  category: "Effect",         // "Effect" | "Instrument" | "Analyzer"
  formats: ["AU", "VST3"],
  io: {
    audio: {
      main: [
        { input: "mono", output: "mono" },
        { input: "stereo", output: "stereo" },
        { input: "5.1", output: "5.1" },
      ],
      sidechain: {
        supported: ["disabled", "mono", "stereo"],
        optional: true,
      },
    },
    midi: {
      input: false,
      output: false,
    },
  },
  ui: { width: 600, height: 400, resizable: false },
};
```

Legacy `channels: { input, output }` is still supported for backward compatibility, but `io.audio` + `io.midi` is recommended for explicit format negotiation.

## Signal Chaining

Chain multiple effects by passing one hook's output to the next:

```tsx
const input = useInput();
const filtered = useFilter(input, { type: "highpass", cutoff: 80 });
const compressed = useCompressor(filtered, { threshold: -12, ratio: 4 });
const output = useGain(compressed, { gain: 0.8 });
useOutput(output);
```

## Development Workflow

### Browser Preview

Running `pnpm dev` without `--host` opens the plugin in your browser with a Web Audio mock. This is the fastest way to iterate on UI.

### Standalone Host

Running `pnpm dev -- --host` builds a real JUCE standalone app that loads your plugin with the live Vite dev server. Audio processing runs through the real C++ engine.

### Hot Reload

When you edit your plugin component, Vite's HMR updates the UI instantly. The audio graph is automatically re-reconciled — only the changed parameters are updated, avoiding audio interruption.

### Production Build

`pnpm build` creates optimized plugin binaries. The React UI is bundled and embedded directly in the binary as resource data — no external files needed.

## Platform-Specific Notes

### macOS
- Outputs AU (`.component`), VST3 (`.vst3`), and Standalone (`.app`)
- AU plugins auto-install to `~/Library/Audio/Plug-Ins/Components/`
- VST3 plugins auto-install to `~/Library/Audio/Plug-Ins/VST3/`

### Windows
- Outputs VST3 (`.vst3`) and Standalone (`.exe`)
- Requires MSVC and CMake
- Uses Edge WebView2 for the UI

### Linux
- Outputs VST3 (`.vst3`) and Standalone
- Requires GCC, CMake, and GTK/WebKit2 development packages

## Next Steps

- Read the [API Reference](./api-reference.md) for all available hooks and components
- Explore the examples in the `examples/` directory
- Check out the [SUMMARY.md](../SUMMARY.md) for the full architecture documentation
