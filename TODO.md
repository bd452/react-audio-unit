# TODO — React Audio Unit

Status legend: done items are checked, remaining items are unchecked.

---

## Phase 1: Core Foundation

### Virtual Audio Graph & Reconciler
- [x] `VirtualAudioGraph` data structure with snapshot/clone
- [x] `diffGraphs()` algorithm (add/remove/update/connect/disconnect)
- [x] `AudioGraphContext` and `PluginHost` provider
- [x] Graph reconciliation in `useEffect` after each render
- [ ] **Call `resetCallIndex()` before each render cycle** — currently `globalCallIndex` in `useAudioNode.ts` is never reset, causing node ID collisions across renders. `PluginHost` needs to reset it at the start of each render pass.
- [ ] **Fast-path parameter-only updates** — the SUMMARY spec describes detecting when only params changed (no topology change) and doing a direct atomic write instead of a full graph diff. Currently every render does a full diff.

### JS ↔ C++ Bridge
- [x] `NativeBridge` class with JUCE WebView detection
- [x] JS → Native messaging via `__JUCE__.backend.emitEvent`
- [x] Native → JS messaging via `evaluateJavascript`
- [x] Bridge protocol types (`BridgeOutMessage`, `BridgeInMessage`)
- [ ] **Fix `WebViewBridge.cpp` — `createWebView()` is broken** — the function resets its own `webView` pointer and returns `nullptr`. The PluginEditor creates the WebView directly instead, bypassing the bridge. Need to either fix `createWebView()` or refactor so the bridge doesn't own WebView creation (just provides config/callbacks).
- [ ] **Fix PluginEditor JS→C++ message path** — the `rau_send` native function handler in `PluginEditor.cpp` has broken callback wiring. Messages from JS never actually reach `PluginProcessor::handleJSMessage()`.
- [ ] **String-to-enum parameter conversion** — JS sends string params like `filterType: "lowpass"`, but C++ `AudioNodeBase` stores all params as `atomic<float>`. The bridge (`PluginProcessor::handleJSMessage`) does `static_cast<float>(prop.value)` which turns strings into `0.0f`. Need a conversion layer that maps:
  - `filterType`: "lowpass"→0, "highpass"→1, "bandpass"→2, "notch"→3, "allpass"→4, "lowshelf"→5, "highshelf"→6, "peaking"→7
  - `waveform`: "sine"→0, "saw"→1, "square"→2, "triangle"→3
  - `distortionType`: "soft"→0, "hard"→1, "tanh"→2, "atan"→3, "foldback"→4
  - `law` (pan): "linear"→0, "equalPower"→1
  - `shape` (LFO): "sine"→0, "triangle"→1, "saw"→2, "square"→3, "random"→4
  - `meterType`: "peak"→0, "rms"→1, "both"→2
- [ ] **Dev/browser mock bridge** — `__RAU_DEV_BRIDGE__` is referenced in `bridge.ts` but never implemented. Need a Web Audio API–backed mock so plugins can be previewed in a browser without the native harness.

### Native Audio Engine
- [x] `AudioGraph` with topological sort (Kahn's algorithm)
- [x] `processBlock()` — drains op queue, processes nodes in order, copies output
- [x] Buffer pool with acquire/release
- [x] Input node passthrough (host buffer → graph)
- [x] `AudioNodeBase` with atomic params, bypass support
- [ ] **Replace `mutex` + `try_lock` with a true lock-free SPSC queue** — current `applyPendingOps()` uses `std::mutex::try_lock()` which is not strictly real-time safe (can cause priority inversion on some OSes). Replace with a single-producer single-consumer lock-free FIFO.
- [ ] **Double-buffered graph swap** — SUMMARY spec describes building a new graph while the old one plays, then atomically swapping at a buffer boundary. Current implementation mutates the live graph inside `applyPendingOps()` on the audio thread.

### DSP Nodes — C++ Implementations
- [x] `GainNode` — smoothed gain with 20ms ramp
- [x] `DelayNode` — circular buffer, linear interpolation, feedback, dry/wet
- [x] `FilterNode` — biquad with 8 filter types, direct-form-II
- [x] `MixNode` — smoothed crossfade between two inputs
- [x] `NodeFactory` — creates nodes by type string
- [ ] **OscillatorNode** — sine/saw/square/triangle waveforms, frequency from param or MIDI input, detune, polyphonic voice management
- [ ] **CompressorNode** — RMS/peak detection, threshold/ratio/attack/release/knee, makeup gain, optional sidechain input
- [ ] **ReverbNode** — algorithmic reverb (Freeverb or Schroeder), room size, damping, pre-delay, dry/wet
- [ ] **DistortionNode** — waveshaper with soft/hard/tanh/atan/foldback curves, drive, output level, dry/wet
- [ ] **PanNode** — stereo panner with linear and equal-power laws
- [ ] **LFONode** — low-frequency oscillator (sine/tri/saw/square/random), rate, depth, phase, tempo sync
- [ ] **EnvelopeNode** — ADSR triggered by MIDI note events, outputs 0–1 control signal
- [ ] **MeterNode** — computes RMS/peak per channel, sends data back to JS via bridge at configurable refresh rate
- [ ] **SpectrumNode** — FFT analysis, sends magnitude array back to JS via bridge
- [ ] **ConvolverNode** — IR-based convolution reverb (load IR from binary data)
- [ ] Register all new nodes in `NodeFactory`

### Parameter Management
- [x] `ParameterStore` with APVTS slot mapping
- [x] `useParameter` hook with DAW automation sync
- [ ] **Fix `ParameterStore::registerParameter()` range mapping** — pre-allocated slots have fixed 0–1 range. When a JS parameter registers with e.g. min=20, max=20000, the actual range isn't updated. Need to either: (a) defer parameter creation until registration, or (b) use `NormalisableRange` mapping in get/set.
- [ ] **Implement `ParameterStore::restoreStateFromJson()`** — currently a stub `(void)json`. Need to parse JSON and call `setParameterValue()` for each key.
- [ ] **Parameter `curve` support** — `useParameter` accepts `curve: 'logarithmic' | 'exponential'` but the native side doesn't apply skew to the `NormalisableRange`.

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
- [ ] **Fix `loadPluginConfig()` for TypeScript files** — currently tries regex extraction + `Function()` constructor which is fragile and fails for many configs. Should use `tsx` or `jiti` to properly evaluate `.ts` config files.
- [ ] **`rau validate` command** — run `auval` (macOS) and VST3 validator against built plugins
- [ ] **Cross-platform build matrix in `rau build`** — `build:mac`, `build:win`, `build:all` flags from the spec

### Templates
- [x] `effect` template with basic gain plugin
- [ ] **`instrument` template** — synth with MIDI input, oscillator, envelope, filter
- [ ] **`analyzer` template** — pass-through with meter + spectrum display

### Development Mode
- [x] Vite dev server with HMR
- [ ] **Standalone host app** — `rau dev --host` should build and launch a minimal JUCE Standalone app that loads the plugin and connects the WebView to the dev server. Currently logged as TODO in `dev.ts`.
- [ ] **Hot reload of audio graph** — when React HMR updates the component, the graph should re-reconcile without audio interruption. This may already work if `PluginHost` properly re-diffs, but needs testing.

### Production Build
- [x] Vite bundles the React app
- [x] CMake builds with `juce_add_binary_data` for embedded UI
- [ ] **Implement embedded UI resource serving** — `PluginEditor.cpp` uses a `data:text/html` placeholder when `RAU_EMBEDDED_UI=1`. Need to implement JUCE's `WebBrowserComponent::Options::withResourceProvider()` to serve files from `BinaryData`.
- [ ] **Build output reporting** — `rau build` tries to list output files but the path logic is fragile. Verify it works for AU/VST3/Standalone outputs.

### UI Components
- [x] Knob (SVG, drag interaction, value display)
- [x] Slider (horizontal/vertical)
- [x] Toggle
- [x] Select
- [x] Meter (canvas-based, peak hold, multi-channel)
- [x] Panel
- [x] XYPad
- [ ] **Waveform display component** — show a time-domain waveform
- [ ] **Spectrum display component** — show frequency spectrum from `useSpectrum` data
- [ ] **Keyboard component** — on-screen MIDI keyboard for instrument plugins
- [ ] **PresetBrowser component** — save/load/browse presets
- [ ] **Light theme** — `themes/light.css` (only dark exists)

---

## Phase 3: Full DSP Library

### Generators
- [ ] Oscillator (sine/saw/square/triangle) — JS hook exists, C++ node missing
- [ ] LFO — JS hook exists, C++ node missing
- [ ] Envelope (ADSR) — JS hook exists, C++ node missing

### Effects
- [ ] Compressor — JS hook exists, C++ node missing
- [ ] Reverb (algorithmic) — JS hook exists, C++ node missing
- [ ] Reverb (convolution/IR) — JS hook exists, C++ node missing
- [ ] Distortion/Waveshaper — JS hook exists, C++ node missing
- [ ] Panner — JS hook exists, C++ node missing
- [ ] Chorus — composable from delay + LFO (needs LFO node first)
- [ ] Flanger — composable from short delay + LFO
- [ ] Phaser — chain of allpass filters modulated by LFO

### Analysis
- [ ] Meter node — JS hook exists, C++ node needs to compute RMS/peak and send to JS
- [ ] Spectrum node — JS hook exists, C++ node needs FFT and send magnitudes to JS

### MIDI
- [ ] MIDI input node — JS hook exists, C++ side needs to forward MIDI events from `processBlock`'s `MidiBuffer` into the graph
- [ ] Polyphonic voice management for instrument plugins
- [ ] Note priority / voice stealing

### Multi-channel
- [ ] Mono ↔ stereo conversion nodes (split/merge)
- [ ] Surround format support (5.1, 7.1)
- [ ] Sidechain input bus configuration

---

## Phase 4: Production Readiness

### State Persistence
- [ ] **Fix state save** — `PluginProcessor::getStateInformation()` only saves APVTS state. The JS-side state (graph topology, non-parameter state) is not included.
- [ ] **Fix state recall** — `setStateInformation()` restores APVTS but doesn't notify JS to rebuild the graph. Need to send a `restoreState` message to JS.
- [ ] **Preset system** — save/load named presets, export/import preset files

### Cross-Platform
- [x] macOS builds (AU + VST3 + Standalone) — verified working
- [ ] **Windows builds** — test with MSVC, ensure Edge WebView2 works
- [ ] **Linux builds** — test with GCC, ensure GTK WebKit2 works
- [ ] **CI/CD pipeline** — GitHub Actions for building on all platforms

### Validation & Testing
- [ ] `auval` validation for AU plugins on macOS
- [ ] VST3 validator
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
  - [ ] Simple Gain (minimal example)
  - [ ] Parametric EQ
  - [ ] Subtractive Synth
  - [ ] Channel Strip (EQ + Comp + Gate)

---

## Critical Bugs (fix before anything else)

1. **`globalCallIndex` never resets** — node IDs collide across renders. `PluginHost` must call `resetCallIndex()` before children render.
2. **PluginEditor bridge wiring broken** — JS messages from the WebView never reach `handleJSMessage()`. The `rau_send` native function handler is a no-op.
3. **String params silently become 0** — `filterType: "lowpass"` is cast to `float` as `0.0f`. All string-enum params are broken.
4. **WebViewBridge.createWebView() returns nullptr** — dead code that confuses the architecture. Either fix or remove.
