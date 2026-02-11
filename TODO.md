# TODO — React Audio Unit

Status legend: done items are checked, remaining items are unchecked.

---

## Phase 1: Core Foundation

### Virtual Audio Graph & Reconciler
- [x] `VirtualAudioGraph` data structure with snapshot/clone
- [x] `diffGraphs()` algorithm (add/remove/update/connect/disconnect)
- [x] `AudioGraphContext` and `PluginHost` provider
- [x] Graph reconciliation in `useEffect` after each render
- [x] **Call `resetCallIndex()` before each render cycle** — moved counter into `VirtualAudioGraph`, resets on `clear()`, exposed via context's `nextCallIndex()`.
- [x] **Fast-path parameter-only updates** — `diffGraphsFull()` now reports `paramOnly` flag; `PluginHost` sends direct `paramUpdate` messages instead of full graph ops when only params changed.

### JS ↔ C++ Bridge
- [x] `NativeBridge` class with JUCE WebView detection
- [x] JS → Native messaging via `__JUCE__.backend.emitEvent`
- [x] Native → JS messaging via `evaluateJavascript`
- [x] Bridge protocol types (`BridgeOutMessage`, `BridgeInMessage`)
- [x] **Fix `WebViewBridge.cpp`** — removed broken `createWebView()`, replaced with `createWebViewOptions()` + `setWebView()` pattern. Bridge no longer owns the WebBrowserComponent.
- [x] **Fix PluginEditor JS→C++ message path** — PluginEditor now uses `createWebViewOptions()` from the bridge (which registers the `rau_js_message` native function), then calls `setWebView()` to enable C++→JS messaging. Messages flow: JS → native function → bridge callback → `handleJSMessage()`.
- [x] **String-to-enum parameter conversion** — added `stringParamToFloat()` and `varToFloat()` in `PluginProcessor.cpp` that maps string values for `filterType`, `waveform`, `distortionType`, `law`, `shape`, `meterType` to their float enum equivalents.
- [x] **Dev/browser mock bridge** — implemented `DevBridge` class with Web Audio API backend in `packages/core/src/dev-bridge.ts`. Auto-installs via `PluginHost` when not inside a JUCE WebView. Provides basic audio passthrough and parameter management for browser preview.

### Native Audio Engine
- [x] `AudioGraph` with topological sort (Kahn's algorithm)
- [x] `processBlock()` — drains op queue, processes nodes in order, copies output
- [x] Buffer pool with acquire/release
- [x] Input node passthrough (host buffer → graph)
- [x] `AudioNodeBase` with atomic params, bypass support
- [x] **Replace `mutex` + `try_lock` with a true lock-free SPSC queue** — implemented `SPSCQueue<T, Size>` in `SPSCQueue.h` using atomic head/tail indices with power-of-2 ring buffer. `AudioGraph::queueOp()` now pushes lock-free; `applyPendingOps()` drains without any mutex.
- [ ] **Double-buffered graph swap** — SUMMARY spec describes building a new graph while the old one plays, then atomically swapping at a buffer boundary. Current implementation mutates the live graph inside `applyPendingOps()` on the audio thread.

### DSP Nodes — C++ Implementations
- [x] `GainNode` — smoothed gain with 20ms ramp
- [x] `DelayNode` — circular buffer, linear interpolation, feedback, dry/wet
- [x] `FilterNode` — biquad with 8 filter types, direct-form-II
- [x] `MixNode` — smoothed crossfade between two inputs
- [x] `NodeFactory` — creates nodes by type string
- [x] **OscillatorNode** — sine/saw/square/triangle waveforms, frequency smoothing, detune support
- [x] **CompressorNode** — peak detection, threshold/ratio/attack/release/knee, makeup gain, sidechain input
- [x] **ReverbNode** — JUCE Reverb (Freeverb), room size, damping, dry/wet
- [x] **DistortionNode** — soft/hard/tanh/atan/foldback waveshaper, drive, output level, dry/wet
- [x] **PanNode** — stereo panner with linear and equal-power laws, smoothed
- [x] **LFONode** — sine/tri/saw/square/random, rate, depth, phase offset
- [x] **EnvelopeNode** — ADSR with gate input or parameter trigger
- [x] **MeterNode** — RMS/peak per channel, atomic data for bridge readout
- [x] **SpectrumNode** — 2048-point FFT, Hann window, magnitude output
- [x] Register all new nodes in `NodeFactory`
- [x] **ConvolverNode** — IR-based convolution reverb using JUCE's `dsp::Convolution` engine. Supports loading IR from raw float data or WAV/AIFF files. Registered in `NodeFactory`.

### Parameter Management
- [x] `ParameterStore` with APVTS slot mapping
- [x] `useParameter` hook with DAW automation sync
- [x] **Fix `ParameterStore::registerParameter()` range mapping** — added `rangeMap` to store min/max per slot; `setParameterValue`, `getParameterValue`, and `parameterChanged` now properly convert between actual values and 0–1 normalized range.
- [x] **Implement `ParameterStore::restoreStateFromJson()`** — now parses JSON with JUCE's JSON parser and calls `setParameterValue()` for each key.
- [x] **Parameter `curve` support** — `ParameterStore::registerParameter()` now accepts a `curve` string ("linear", "logarithmic", "exponential"). Stores a `skew` factor per slot and applies power-curve conversion in `actualToNormalized()` / `normalizedToActual()`. `PluginProcessor` forwards the `curve` field from the JS `registerParameter` message.

### I/O Hooks
- [x] `useInput` — wraps the DAW audio input as a Signal
- [x] `useOutput` — designates the output node
- [ ] **Multi-bus I/O** — `useInput(channel)` accepts a bus index but the C++ side only handles a single stereo input. Need to support sidechain and multi-bus configurations.

---

## Phase 2: Developer Experience

### CLI
- [x] `rau create` — scaffolds from template, updates names
- [x] `rau dev` — starts Vite dev server
- [x] `rau build` — invokes Vite then CMake
- [x] **Fix `loadPluginConfig()` for TypeScript files** — now uses `jiti` to properly evaluate `.ts` config files natively.
- [x] **`rau validate` command** — implemented in `packages/cli/src/commands/validate.ts`. Runs `auval -a` on macOS to check AU registration, validates VST3 bundle structure (Contents/MacOS/ binary), and optionally invokes `VST3Inspector` if available.
- [ ] **Cross-platform build matrix in `rau build`** — `build:mac`, `build:win`, `build:all` flags from the spec

### Templates
- [x] `effect` template with basic gain plugin
- [x] **`instrument` template** — synth with oscillator, filter, envelope, volume controls
- [x] **`analyzer` template** — pass-through with meter + spectrum display

### Development Mode
- [x] Vite dev server with HMR
- [x] **Standalone host app** — `rau dev --host` now loads plugin config, builds the Standalone target via CMake, locates the `.app` bundle, and launches it with `open`. Supports monorepo and installed `@react-audio-unit/native`.
- [ ] **Hot reload of audio graph** — when React HMR updates the component, the graph should re-reconcile without audio interruption. This may already work if `PluginHost` properly re-diffs, but needs testing.

### Production Build
- [x] Vite bundles the React app
- [x] CMake builds with `juce_add_binary_data` for embedded UI
- [x] **Implement embedded UI resource serving** — PluginEditor now uses `withResourceProvider()` to serve files from BinaryData, with proper MIME type detection.
- [x] **Build output reporting** — `rau build` now uses sanitized target name to locate artefacts, tries multiple candidate paths, and recursively lists `.component`, `.vst3`, `.aaxplugin`, and `.app` files.

### UI Components
- [x] Knob (SVG, drag interaction, value display)
- [x] Slider (horizontal/vertical)
- [x] Toggle
- [x] Select (supports string[] and { value, label }[] options)
- [x] Meter (canvas-based, peak hold, multi-channel, label support)
- [x] Panel (layout container with `direction` and `gap` props)
- [x] XYPad
- [x] **Waveform display component** — canvas-based time-domain waveform renderer
- [x] **Spectrum display component** — canvas-based frequency bar graph with log scale support
- [x] **Keyboard component** — on-screen MIDI keyboard with note on/off callbacks
- [x] **PresetBrowser component** — save/load/browse/delete presets with prev/next navigation
- [x] **Light theme** — `themes/light.css`

---

## Phase 3: Full DSP Library

### Generators
- [x] Oscillator (sine/saw/square/triangle) — JS hook + C++ node
- [x] LFO — JS hook + C++ node
- [x] Envelope (ADSR) — JS hook + C++ node

### Effects
- [x] Compressor — JS hook + C++ node
- [x] Reverb (algorithmic) — JS hook + C++ node
- [x] Reverb (convolution/IR) — C++ `ConvolverNode` implemented with JUCE `dsp::Convolution`
- [x] Distortion/Waveshaper — JS hook + C++ node
- [x] Panner — JS hook + C++ node
- [ ] Chorus — composable from delay + LFO (needs testing)
- [ ] Flanger — composable from short delay + LFO
- [ ] Phaser — chain of allpass filters modulated by LFO

### Analysis
- [x] Meter node — JS hook + C++ node (computes RMS/peak)
- [x] Spectrum node — JS hook + C++ node (FFT magnitudes)
- [x] **Analysis data bridge** — `PluginProcessor` has an `AnalysisTimer` (30Hz) that reads `MeterNode` peak/RMS and `SpectrumNode` FFT magnitudes and sends them to JS as `meterData` and `spectrumData` bridge messages. `AudioGraph::getNodesByType()` enables efficient node lookup.

### MIDI
- [x] MIDI input node — `PluginProcessor::processBlock()` now iterates `MidiBuffer`, serializes noteOn/noteOff/CC/pitchBend events to JSON, and sends via `webViewBridge.sendToJS()` as `{"type":"midi","events":[...]}`.
- [ ] Polyphonic voice management for instrument plugins
- [ ] Note priority / voice stealing

### Multi-channel
- [ ] Mono ↔ stereo conversion nodes (split/merge)
- [ ] Surround format support (5.1, 7.1)
- [ ] Sidechain input bus configuration

---

## Phase 4: Production Readiness

### State Persistence
- [x] **Fix state save** — `PluginProcessor::getStateInformation()` now saves both APVTS state and JS-side parameter state (via `paramStore.getStateAsJson()`).
- [x] **Fix state recall** — `setStateInformation()` now restores APVTS state, sends `restoreState` message to JS, and calls `paramStore.restoreStateFromJson()`.
- [ ] **Preset system** — save/load named presets, export/import preset files

### Cross-Platform
- [x] macOS builds (AU + VST3 + Standalone) — verified working
- [ ] **Windows builds** — test with MSVC, ensure Edge WebView2 works
- [ ] **Linux builds** — test with GCC, ensure GTK WebKit2 works
- [ ] **CI/CD pipeline** — GitHub Actions for building on all platforms

### Validation & Testing
- [x] `auval` validation for AU plugins on macOS — covered by `rau validate` command
- [x] VST3 validator — structural validation in `rau validate`, full validation with Steinberg SDK tools if installed
- [ ] DAW compatibility testing (Logic, Ableton, Reaper, FL Studio, Pro Tools)
- [ ] Automated test suite for:
  - [ ] Graph differ (unit tests)
  - [ ] Bridge protocol (integration tests)
  - [ ] DSP node accuracy (compare against reference)
  - [ ] Parameter save/recall round-trip

### Performance
- [ ] Profile WebView startup time — measure and optimize
- [ ] Profile bridge latency — measure parameter update round-trip
- [ ] Profile audio graph `processBlock` — ensure it meets real-time constraints at 64-sample buffers
- [ ] Memory usage audit — measure per-instance overhead

### Documentation
- [ ] Getting started guide
- [ ] API reference for all hooks and components
- [ ] Custom DSP node authoring guide (C++ extension API)
- [ ] Deployment guide (code signing, notarization, installers)
- [ ] Example plugins:
  - [x] Echo Delay
  - [x] Simple Gain (minimal example) — `examples/simple-gain/`
  - [x] Parametric EQ — `examples/parametric-eq/` (4-band EQ with spectrum display, logarithmic frequency curves)
  - [x] Subtractive Synth — `examples/subtractive-synth/` (oscillator + filter + ADSR + on-screen keyboard)
  - [x] Channel Strip (EQ + Comp + Gate) — `examples/channel-strip/` (HP filter + 3-band EQ + compressor + input/output metering)

---

## Critical Bugs (all fixed)

1. ~~**`globalCallIndex` never resets**~~ — Fixed: counter moved into `VirtualAudioGraph`, resets on `clear()`, exposed via `nextCallIndex()` on the context.
2. ~~**PluginEditor bridge wiring broken**~~ — Fixed: refactored `WebViewBridge` to provide options (with native function), PluginEditor creates WebView with those options and calls `setWebView()`.
3. ~~**String params silently become 0**~~ — Fixed: added `varToFloat()` in `PluginProcessor.cpp` with conversion tables for all string-enum params.
4. ~~**WebViewBridge.createWebView() returns nullptr**~~ — Fixed: removed `createWebView()`, replaced with `createWebViewOptions()` + `setWebView()` pattern.
