# React Audio Unit

A framework for building AudioUnit/VST/VST3/AAX plugins with React and JavaScript.

## Core Idea

Plugin authors write a single React component that describes **both** the UI and the audio processing graph. React hooks represent audio DSP nodes; standard JSX represents the UI. When state changes, React re-renders, the audio graph description is reconciled, and minimal delta operations are sent to a native C++ audio engine over a lock-free bridge.

```jsx
import { useInput, useOutput, useParameter, useDelay, useMix } from '@react-audio-unit/dsp'
import { Knob, Panel } from '@react-audio-unit/ui'

export default function EchoPlugin() {
  const input = useInput()
  const [time, setTime] = useParameter('time', { default: 500, min: 0, max: 2000, label: 'Delay Time' })
  const [feedback, setFeedback] = useParameter('feedback', { default: 0.3, min: 0, max: 0.95, label: 'Feedback' })
  const [mix, setMix] = useParameter('mix', { default: 0.5, min: 0, max: 1, label: 'Dry/Wet' })

  const delayed = useDelay(input, { time, feedback })
  const output = useMix(input, delayed, mix)
  useOutput(output)

  return (
    <Panel title="Echo">
      <Knob label="Time" value={time} onChange={setTime} unit="ms" />
      <Knob label="Feedback" value={feedback} onChange={setFeedback} />
      <Knob label="Mix" value={mix} onChange={setMix} />
    </Panel>
  )
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DAW (Host)                                 │
│   Sends audio buffers, parameter automation, MIDI, transport info   │
└──────────────┬──────────────────────────────────────┬───────────────┘
               │ Audio Thread                         │ Main Thread
               ▼                                      ▼
┌──────────────────────────┐        ┌──────────────────────────────────┐
│   Native Audio Engine    │◄──────►│         JUCE WebView             │
│      (C++ / JUCE)        │ Lock-  │    ┌──────────────────────────┐  │
│                          │ Free   │    │   React Application      │  │
│  ┌────────────────────┐  │ Bridge │    │                          │  │
│  │  DSP Node Graph    │  │        │    │  ┌──────────────────┐   │  │
│  │                    │  │        │    │  │  Audio Graph      │   │  │
│  │  [In]→[Delay]→[+] │  │        │    │  │  Reconciler       │   │  │
│  │          ↑    │    │  │        │    │  └────────┬─────────┘   │  │
│  │          └────┘    │  │        │    │           │              │  │
│  │               ↓    │  │        │    │  ┌────────▼─────────┐   │  │
│  │             [Out]  │  │        │    │  │  Virtual Audio    │   │  │
│  └────────────────────┘  │        │    │  │  Graph (VDOM-like)│   │  │
│                          │        │    │  └──────────────────┘   │  │
│  ┌────────────────────┐  │        │    │                          │  │
│  │ Parameter Store    │  │        │    │  ┌──────────────────┐   │  │
│  │ (atomics + SPSC)   │  │        │    │  │  React UI (JSX)  │   │  │
│  └────────────────────┘  │        │    │  └──────────────────┘   │  │
└──────────────────────────┘        │    └──────────────────────────┘  │
                                    └──────────────────────────────────┘
```

### Layer 1: Native Plugin Harness (C++ / JUCE)

The outermost layer is a JUCE-based C++ plugin that handles:

- **Plugin format wrapping**: VST3, AudioUnit, AAX via JUCE's `AudioProcessor`
- **Audio thread processing**: Runs a C++ DSP node graph at real-time priority
- **WebView hosting**: Embeds an OS-native WebView (WebKit on macOS, Edge/Chromium on Windows) for the React UI
- **Parameter management**: Exposes parameters to the DAW for automation, save/recall
- **State persistence**: Serializes/deserializes plugin state by calling into JS

The C++ side is **mostly generated/templated**. Plugin authors don't write C++.

### Layer 2: Lock-Free Bridge

Communication between the WebView (JS/React) and the audio engine (C++) uses:

| Direction          | Mechanism                     | Latency       | Use Case                      |
| ------------------ | ----------------------------- | ------------- | ----------------------------- |
| JS → C++ param     | Atomic write via bridge call  | < 1 buffer    | Knob turns, parameter changes |
| JS → C++ graph     | Message queue (SPSC FIFO)     | ~1-5ms        | Graph topology changes        |
| C++ → JS param     | Polling queue + `postMessage` | ~16ms (frame) | Host automation, meters       |
| C++ → JS transport | Polling queue                 | ~16ms         | Play/stop, BPM, position      |

**Bridge Protocol** (JSON-based for simplicity, binary for performance-critical paths):

```json
// JS → Native: Parameter update
{ "type": "param", "id": "time", "value": 750.0 }

// JS → Native: Graph update (after reconciliation)
{ "type": "graph", "ops": [
    { "op": "add", "nodeId": "n3", "nodeType": "delay", "params": { "time": 500 } },
    { "op": "connect", "from": "n1", "outlet": 0, "to": "n3", "inlet": 0 },
    { "op": "remove", "nodeId": "n2" }
]}

// Native → JS: Parameter changed by host automation
{ "type": "paramChanged", "id": "time", "value": 750.0 }

// Native → JS: Meter/analysis data
{ "type": "meter", "id": "output", "rms": -12.3, "peak": -6.1 }
```

### Layer 3: Audio Graph Reconciler

This is the heart of the framework — a **custom React reconciler** (built on `react-reconciler`) that manages a virtual audio graph alongside the DOM.

When React renders:

1. **Audio hooks execute** → each hook registers/updates a node in the virtual audio graph
2. **Commit phase** → the reconciler diffs the new virtual graph against the previous one
3. **Delta operations** → minimal add/remove/update/connect/disconnect operations are computed
4. **Bridge dispatch** → operations are sent to the native engine via the lock-free bridge
5. **Native engine applies** → graph changes are applied atomically between audio buffer callbacks

This mirrors React DOM's approach: instead of diffing DOM trees, we diff audio graph trees.

### Layer 4: React Application

The plugin author's code. A standard React app with:

- **Audio hooks** (`useDelay`, `useFilter`, `useGain`, ...) that define the DSP graph
- **Parameter hooks** (`useParameter`) that register automatable parameters with the DAW
- **UI components** (`<Knob>`, `<Slider>`, `<Meter>`, ...) for the plugin interface
- **Standard React** (`useState`, `useEffect`, `useMemo`, ...) for state management

---

## Key Design Decisions

### 1. Why React Hooks for Audio Nodes?

React's Rules of Hooks enforce **static call order** — you can't conditionally call hooks. This maps perfectly to audio DSP constraints: real-time audio graphs must have **static topology**. Dynamic topology changes (adding/removing nodes mid-stream) cause clicks and glitches. The rules of hooks naturally prevent this at the API level.

When parameters change, React re-renders and hooks re-execute with new parameter values, but the graph topology (which nodes exist, how they're connected) remains stable. Only parameter values are updated — which is exactly what happens in professional audio plugins.

```jsx
// ✅ Correct: Static topology, dynamic parameters
function Plugin() {
  const input = useInput()
  const [cutoff] = useParameter('cutoff', { default: 1000 })
  const filtered = useFilter(input, { type: 'lowpass', cutoff })  // always called
  useOutput(filtered)                                               // always called
}

// ❌ Wrong: Dynamic topology (violates rules of hooks AND audio best practices)
function Plugin() {
  const input = useInput()
  const [useFilter] = useState(false)
  if (useFilter) {                    // conditional hook = React error
    const filtered = useFilter(input, { cutoff: 1000 })
  }
}
```

For cases where you genuinely need to "bypass" a node, hooks accept an `enabled`/`bypass` parameter that the native engine handles without topology changes:

```jsx
const filtered = useFilter(input, { type: 'lowpass', cutoff, bypass: !filterEnabled })
```

### 2. Why JUCE + WebView (Not Pure JS Audio)?

**JavaScript cannot run on the audio thread.** GC pauses, JIT deoptimizations, and non-deterministic execution make JS unsuitable for real-time audio processing. The framework uses JS/React purely for:

- Declaring the audio graph topology and parameters
- Rendering the UI
- Managing plugin state

Actual sample-by-sample DSP runs in **C++ on the audio thread**, in a graph of pre-built native DSP nodes that the React reconciler assembles.

### 3. Why Not a Lightweight JS Runtime (QuickJS/Hermes) for DSP?

Even lightweight runtimes can't guarantee real-time safety. A single GC cycle during a 2.9ms audio buffer (128 samples @ 44.1kHz) causes audible glitches. The WebView approach gives us:

- Full React/browser ecosystem
- Hot reloading during development
- CSS/HTML for UI (designers can contribute)
- DevTools for debugging

While keeping audio processing native and real-time safe.

### 4. Signal Identity via Opaque Handles

Audio hooks don't return actual audio data (which would be massive — thousands of floating point samples per frame). Instead, they return lightweight **signal handles** — opaque references to nodes in the virtual audio graph:

```typescript
type Signal = {
  __brand: 'AudioSignal'
  nodeId: string
  outlet: number
}

function useDelay(input: Signal, params: DelayParams): Signal {
  const nodeId = useAudioNode('delay', params, [input])
  return { __brand: 'AudioSignal', nodeId, outlet: 0 }
}
```

Passing signals between hooks establishes connections in the virtual graph. The native engine resolves these to actual buffer pointers.

---

## Package Structure

```
react-audio-unit/
├── packages/
│   ├── core/                          # @react-audio-unit/core
│   │   ├── src/
│   │   │   ├── reconciler.ts          # Custom React reconciler for audio graph
│   │   │   ├── audio-context.tsx       # React context providing bridge access
│   │   │   ├── virtual-graph.ts        # Virtual audio graph data structure
│   │   │   ├── graph-differ.ts         # Diff algorithm for audio graphs
│   │   │   ├── bridge.ts              # JS side of the native bridge
│   │   │   └── types.ts              # Core type definitions
│   │   └── package.json
│   │
│   ├── dsp/                           # @react-audio-unit/dsp
│   │   ├── src/
│   │   │   ├── hooks/
│   │   │   │   ├── useInput.ts        # DAW audio input
│   │   │   │   ├── useOutput.ts       # DAW audio output
│   │   │   │   ├── useParameter.ts    # DAW-automatable parameter
│   │   │   │   ├── useGain.ts         # Gain node
│   │   │   │   ├── useDelay.ts        # Delay line
│   │   │   │   ├── useFilter.ts       # Biquad filter (LP/HP/BP/Notch)
│   │   │   │   ├── useOscillator.ts   # Oscillator (sine/saw/square/tri)
│   │   │   │   ├── useCompressor.ts   # Dynamics compressor
│   │   │   │   ├── useReverb.ts       # Algorithmic reverb
│   │   │   │   ├── useConvolver.ts    # Convolution (IR reverb)
│   │   │   │   ├── useDistortion.ts   # Waveshaper distortion
│   │   │   │   ├── usePan.ts         # Stereo panner
│   │   │   │   ├── useMix.ts         # Dry/wet mixer
│   │   │   │   ├── useSplit.ts       # Channel splitter
│   │   │   │   ├── useMerge.ts       # Channel merger
│   │   │   │   ├── useMeter.ts       # Level metering (sends data back to JS)
│   │   │   │   ├── useSpectrum.ts     # FFT spectrum analysis
│   │   │   │   ├── useEnvelope.ts     # ADSR envelope
│   │   │   │   ├── useLFO.ts         # Low-frequency oscillator
│   │   │   │   ├── useMidi.ts        # MIDI input
│   │   │   │   └── useTransport.ts    # DAW transport (BPM, position, playing)
│   │   │   ├── useAudioNode.ts        # Low-level hook: registers a node in the graph
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                            # @react-audio-unit/ui
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Knob.tsx           # Rotary knob control
│   │   │   │   ├── Slider.tsx         # Linear fader/slider
│   │   │   │   ├── Toggle.tsx         # On/off toggle switch
│   │   │   │   ├── Select.tsx         # Dropdown selector
│   │   │   │   ├── Meter.tsx          # Level meter (VU/Peak/RMS)
│   │   │   │   ├── Waveform.tsx       # Waveform display
│   │   │   │   ├── Spectrum.tsx       # Spectrum analyzer display
│   │   │   │   ├── XYPad.tsx          # 2D X/Y controller
│   │   │   │   ├── Panel.tsx          # Layout container with label
│   │   │   │   ├── Keyboard.tsx       # MIDI keyboard
│   │   │   │   └── PresetBrowser.tsx  # Preset save/load UI
│   │   │   ├── themes/
│   │   │   │   ├── dark.css
│   │   │   │   └── light.css
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── native/                        # C++ JUCE plugin harness
│   │   ├── src/
│   │   │   ├── PluginProcessor.h/cpp  # JUCE AudioProcessor (hosts the DSP graph)
│   │   │   ├── PluginEditor.h/cpp     # JUCE AudioProcessorEditor (hosts the WebView)
│   │   │   ├── WebViewBridge.h/cpp    # C++ side of the JS bridge
│   │   │   ├── AudioGraph.h/cpp       # Real-time DSP node graph engine
│   │   │   ├── nodes/                 # Built-in DSP node implementations
│   │   │   │   ├── GainNode.h/cpp
│   │   │   │   ├── DelayNode.h/cpp
│   │   │   │   ├── FilterNode.h/cpp
│   │   │   │   ├── OscillatorNode.h/cpp
│   │   │   │   ├── CompressorNode.h/cpp
│   │   │   │   ├── ReverbNode.h/cpp
│   │   │   │   ├── ConvolverNode.h/cpp
│   │   │   │   ├── DistortionNode.h/cpp
│   │   │   │   ├── PanNode.h/cpp
│   │   │   │   ├── MixNode.h/cpp
│   │   │   │   ├── MeterNode.h/cpp
│   │   │   │   ├── SpectrumNode.h/cpp
│   │   │   │   └── ...
│   │   │   ├── ParameterStore.h/cpp   # Thread-safe parameter management
│   │   │   └── StateSerializer.h/cpp  # Plugin state save/recall
│   │   ├── CMakeLists.txt
│   │   └── JUCE/                      # JUCE as a submodule
│   │
│   └── cli/                           # @react-audio-unit/cli
│       ├── src/
│       │   ├── commands/
│       │   │   ├── create.ts          # Scaffold a new plugin project
│       │   │   ├── dev.ts             # Start dev server + hot reload
│       │   │   ├── build.ts           # Build production plugin binaries
│       │   │   └── validate.ts        # Validate plugin against AU/VST specs
│       │   └── index.ts
│       └── package.json
│
├── templates/                         # Plugin project templates
│   ├── effect/                        # Audio effect template
│   ├── instrument/                    # Virtual instrument template
│   └── analyzer/                      # Analysis/visualization template
│
├── examples/
│   ├── simple-gain/                   # Simplest possible plugin
│   ├── echo-delay/                    # Delay effect with feedback
│   ├── parametric-eq/                 # Multi-band parametric EQ
│   ├── synth/                         # Basic subtractive synthesizer
│   └── channel-strip/                 # Full channel strip (EQ + Comp + Gate)
│
└── docs/
    ├── getting-started.md
    ├── api-reference.md
    ├── custom-dsp-nodes.md
    └── deployment.md
```

---

## Implementation Deep Dive

### The Virtual Audio Graph

The virtual audio graph is a directed acyclic graph (DAG) of nodes, analogous to React's virtual DOM:

```typescript
// virtual-graph.ts

interface AudioNode {
  id: string              // Stable identity (derived from hook call order)
  type: string            // 'delay' | 'filter' | 'gain' | ...
  params: Record<string, number | string | boolean>
  inputs: Connection[]    // Incoming connections
  bypass: boolean
}

interface Connection {
  fromNodeId: string
  fromOutlet: number
  toInlet: number
}

interface VirtualAudioGraph {
  nodes: Map<string, AudioNode>
  outputNodeId: string | null
}
```

### The Core Hook: `useAudioNode`

Every DSP hook is built on `useAudioNode`, which registers a node in the virtual graph:

```typescript
// useAudioNode.ts

let callIndex = 0  // Reset at start of each render

function useAudioNode(
  type: string,
  params: Record<string, number | string | boolean>,
  inputs: Signal[]
): string {
  const graph = useContext(AudioGraphContext)
  const nodeId = useRef<string | null>(null)

  // Stable ID from component + hook call order (like React's hook identity)
  if (nodeId.current === null) {
    nodeId.current = `${getCurrentComponentId()}_${callIndex++}`
  }

  // Register/update this node in the virtual graph during render
  graph.registerNode({
    id: nodeId.current,
    type,
    params,
    inputs: inputs.map((sig, i) => ({
      fromNodeId: sig.nodeId,
      fromOutlet: sig.outlet,
      toInlet: i
    })),
    bypass: params.bypass ?? false
  })

  return nodeId.current
}
```

### Higher-Level DSP Hooks

Each DSP hook is a thin wrapper around `useAudioNode`:

```typescript
// useDelay.ts
interface DelayParams {
  time: number       // milliseconds
  feedback?: number  // 0-1
  bypass?: boolean
}

function useDelay(input: Signal, params: DelayParams): Signal {
  const nodeId = useAudioNode('delay', {
    time: params.time,
    feedback: params.feedback ?? 0,
    bypass: params.bypass ?? false
  }, [input])

  return useMemo(() => ({
    __brand: 'AudioSignal' as const,
    nodeId,
    outlet: 0
  }), [nodeId])
}
```

```typescript
// useFilter.ts
type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass'

interface FilterParams {
  type: FilterType
  cutoff: number     // Hz
  resonance?: number // Q factor
  bypass?: boolean
}

function useFilter(input: Signal, params: FilterParams): Signal {
  const nodeId = useAudioNode('filter', {
    filterType: params.type,
    cutoff: params.cutoff,
    resonance: params.resonance ?? 0.707,
    bypass: params.bypass ?? false
  }, [input])

  return useMemo(() => ({
    __brand: 'AudioSignal' as const,
    nodeId,
    outlet: 0
  }), [nodeId])
}
```

### The `useParameter` Hook

This hook registers a parameter with the DAW's automation system:

```typescript
// useParameter.ts
interface ParameterConfig {
  default: number
  min: number
  max: number
  label: string
  unit?: string        // 'ms', 'Hz', 'dB', '%'
  curve?: 'linear' | 'logarithmic' | 'exponential'
  steps?: number       // for discrete/stepped parameters
}

function useParameter(
  id: string,
  config: ParameterConfig
): [number, (value: number) => void] {
  const bridge = useContext(BridgeContext)

  // Register parameter with native side on mount
  useEffect(() => {
    bridge.registerParameter(id, config)
    return () => bridge.unregisterParameter(id)
  }, [id])

  const [value, setValue] = useState(config.default)

  // Listen for host automation changes
  useEffect(() => {
    const unsub = bridge.onParameterChanged(id, (newValue) => {
      setValue(newValue)
    })
    return unsub
  }, [id])

  // Send parameter changes to native side
  const setParameter = useCallback((newValue: number) => {
    setValue(newValue)
    bridge.setParameter(id, newValue)
  }, [id])

  return [value, setParameter]
}
```

### Graph Reconciliation Algorithm

After each React render cycle, the reconciler diffs the old and new virtual audio graphs:

```typescript
// graph-differ.ts

interface GraphOp {
  op: 'add' | 'remove' | 'update' | 'connect' | 'disconnect'
  nodeId?: string
  nodeType?: string
  params?: Record<string, number | string | boolean>
  from?: { nodeId: string; outlet: number }
  to?: { nodeId: string; inlet: number }
}

function diffGraphs(prev: VirtualAudioGraph, next: VirtualAudioGraph): GraphOp[] {
  const ops: GraphOp[] = []

  // 1. Find removed nodes
  for (const [id, node] of prev.nodes) {
    if (!next.nodes.has(id)) {
      // Disconnect all connections first
      for (const conn of node.inputs) {
        ops.push({ op: 'disconnect', from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet }, to: { nodeId: id, inlet: conn.toInlet } })
      }
      ops.push({ op: 'remove', nodeId: id })
    }
  }

  // 2. Find added nodes
  for (const [id, node] of next.nodes) {
    if (!prev.nodes.has(id)) {
      ops.push({ op: 'add', nodeId: id, nodeType: node.type, params: node.params })
      for (const conn of node.inputs) {
        ops.push({ op: 'connect', from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet }, to: { nodeId: id, inlet: conn.toInlet } })
      }
    }
  }

  // 3. Find updated params (topology unchanged, parameters changed)
  for (const [id, nextNode] of next.nodes) {
    const prevNode = prev.nodes.get(id)
    if (prevNode && !shallowEqual(prevNode.params, nextNode.params)) {
      ops.push({ op: 'update', nodeId: id, params: nextNode.params })
    }
  }

  // 4. Find changed connections
  for (const [id, nextNode] of next.nodes) {
    const prevNode = prev.nodes.get(id)
    if (prevNode) {
      // Diff connections...
      const prevConns = new Set(prevNode.inputs.map(c => `${c.fromNodeId}:${c.fromOutlet}->${c.toInlet}`))
      const nextConns = new Set(nextNode.inputs.map(c => `${c.fromNodeId}:${c.fromOutlet}->${c.toInlet}`))

      for (const conn of nextNode.inputs) {
        const key = `${conn.fromNodeId}:${conn.fromOutlet}->${conn.toInlet}`
        if (!prevConns.has(key)) {
          ops.push({ op: 'connect', from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet }, to: { nodeId: id, inlet: conn.toInlet } })
        }
      }
      for (const conn of prevNode.inputs) {
        const key = `${conn.fromNodeId}:${conn.fromOutlet}->${conn.toInlet}`
        if (!nextConns.has(key)) {
          ops.push({ op: 'disconnect', from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet }, to: { nodeId: id, inlet: conn.toInlet } })
        }
      }
    }
  }

  return ops
}
```

### Fast Path: Parameter-Only Updates

The most common update is a parameter change (user turns a knob). The reconciler detects this as a parameter-only update and uses the **fast path**: a direct atomic write to the native parameter store, bypassing the full graph diff.

```typescript
// In the reconciler commit phase:
if (onlyParamsChanged(prevGraph, nextGraph)) {
  // Fast path: atomic parameter update
  for (const [nodeId, params] of changedParams) {
    bridge.updateNodeParams(nodeId, params)  // Direct atomic write
  }
} else {
  // Full path: graph diff + operation dispatch
  const ops = diffGraphs(prevGraph, nextGraph)
  bridge.dispatchGraphOps(ops)
}
```

---

## Native Audio Engine (C++)

### DSP Node Graph

The C++ audio engine maintains a topologically-sorted array of DSP nodes. On each `processBlock` call:

```cpp
// AudioGraph.cpp
void AudioGraph::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    // Apply any pending graph operations from the message queue
    applyPendingOps();

    // Process nodes in topological order
    for (auto* node : sortedNodes) {
        if (node->isBypassed()) {
            node->processBypass();  // Pass-through input to output
        } else {
            node->process(bufferPool, midi);
        }
    }
}
```

### Thread Safety Model

```
Audio Thread                    Message Thread                 WebView (JS)
────────────                    ──────────────                 ────────────
                                                               User turns knob
                                                               ──► setParameter()
                                ◄── bridge.setParameter() ────
                                writes atomic<float>
reads atomic<float> ◄───────── 
uses in processBlock()

                                                               Graph topology change
                                                               ──► dispatchGraphOps()
                                ◄── bridge.dispatchGraphOps()─
                                queues ops in SPSC FIFO
reads ops from FIFO ◄──────── 
applies in processBlock()
(between buffer callbacks)
```

**Key invariant**: The audio thread **never blocks**. It reads atomics and drains lock-free queues. All blocking operations happen on the message thread.

### Native Node Interface

```cpp
// AudioNodeBase.h
class AudioNodeBase {
public:
    virtual ~AudioNodeBase() = default;

    virtual void prepare(double sampleRate, int maxBlockSize) = 0;
    virtual void process(BufferPool& pool, juce::MidiBuffer& midi) = 0;
    virtual void processBypass() { /* default: copy input to output */ }

    // Thread-safe parameter update (called from message thread, read from audio thread)
    void setParam(const std::string& name, float value) {
        auto it = params.find(name);
        if (it != params.end()) {
            it->second.store(value, std::memory_order_relaxed);
        }
    }

    float getParam(const std::string& name) const {
        return params.at(name).load(std::memory_order_relaxed);
    }

protected:
    std::unordered_map<std::string, std::atomic<float>> params;
    std::vector<BufferRef> inputBuffers;
    BufferRef outputBuffer;
};
```

### Buffer Pool

To avoid allocations on the audio thread, a pre-allocated buffer pool is used:

```cpp
// BufferPool.h
class BufferPool {
public:
    BufferPool(int numBuffers, int numChannels, int maxBlockSize);

    BufferRef acquire();          // O(1), no allocation
    void release(BufferRef ref);  // O(1), no deallocation

private:
    std::vector<juce::AudioBuffer<float>> buffers;
    std::vector<bool> inUse;  // Could use a lock-free freelist for audio thread
};
```

---

## Developer Experience

### CLI Workflow

```bash
# Create a new plugin project
npx @react-audio-unit/cli create my-plugin --template effect

# Start development (hot-reloading React UI in a standalone window)
cd my-plugin
npm run dev

# Build production plugin binaries
npm run build          # Builds for current platform
npm run build:mac      # macOS: AU + VST3
npm run build:win      # Windows: VST3 + AAX
npm run build:all      # Cross-compile all

# Validate plugin
npm run validate       # Runs AU/VST3 validation tools
```

### Development Mode

During development, the WebView connects to a Vite dev server with HMR (Hot Module Replacement). The audio graph reconciler supports hot-swapping: when the component tree updates, the graph is re-reconciled without audio interruption.

```
┌─────────────────────────────────┐
│        Standalone Host          │  (Minimal JUCE app that hosts the plugin)
│  ┌───────────────────────────┐  │
│  │  WebView → localhost:5173 │──│──► Vite Dev Server (HMR)
│  │        (React App)        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │    Audio Engine (C++)     │  │  ◄─► Test audio file or system audio input
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Production Build

For production, the React app is bundled (Vite/Rollup) and embedded as binary data in the JUCE plugin:

1. `vite build` → produces optimized `index.html` + JS/CSS bundle
2. JUCE `BinaryData` generator embeds the bundle in the C++ binary
3. CMake builds the final `.component` (AU) / `.vst3` / `.aaxplugin` files
4. Plugin serves the UI from memory (no external dependencies)

### Project Structure (Plugin Author)

```
my-plugin/
├── src/
│   ├── Plugin.tsx          # Main plugin component
│   ├── components/         # Custom UI components
│   └── dsp/                # Custom DSP hooks (composing built-in hooks)
├── assets/
│   ├── impulse-responses/  # IR files for convolution
│   └── images/             # UI images/textures
├── plugin.config.ts        # Plugin metadata (name, vendor, formats, etc.)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

```typescript
// plugin.config.ts
export default {
  name: 'My Echo Plugin',
  vendor: 'My Company',
  vendorId: 'MyCo',
  pluginId: 'McEp',
  version: '1.0.0',
  category: 'Effect',          // 'Effect' | 'Instrument' | 'Analyzer'
  formats: ['AU', 'VST3'],    // Target formats
  io: {
    audio: {
      main: [
        { input: 'mono', output: 'mono' },
        { input: 'stereo', output: 'stereo' },
        { input: '5.1', output: '5.1' }
      ],
      sidechain: {
        supported: ['disabled', 'mono', 'stereo'],
        optional: true
      }
    },
    midi: {
      input: false,
      output: false
    }
  },
  ui: {
    width: 600,
    height: 400,
    resizable: true
  }
}
```

---

## Advanced Patterns

### Composing DSP Hooks

Plugin authors can create reusable DSP building blocks by composing hooks:

```tsx
// A reusable chorus effect built from primitives
function useChorus(input: Signal, params: { rate: number; depth: number; mix: number }): Signal {
  const lfo = useLFO({ rate: params.rate, shape: 'sine' })
  const modulated = useDelay(input, {
    time: 20,                    // base delay in ms
    modulation: lfo,
    modulationDepth: params.depth
  })
  return useMix(input, modulated, params.mix)
}

// Used in a plugin
export default function ChorusPlugin() {
  const input = useInput()
  const [rate] = useParameter('rate', { default: 1.5, min: 0.1, max: 10, label: 'Rate' })
  const [depth] = useParameter('depth', { default: 0.5, min: 0, max: 1, label: 'Depth' })
  const [mix] = useParameter('mix', { default: 0.5, min: 0, max: 1, label: 'Mix' })

  const output = useChorus(input, { rate, depth, mix })
  useOutput(output)

  return (
    <Panel title="Chorus">
      <Knob label="Rate" value={rate} unit="Hz" />
      <Knob label="Depth" value={depth} />
      <Knob label="Mix" value={mix} />
    </Panel>
  )
}
```

### Multi-Band Processing

```tsx
function MultibandCompressor() {
  const input = useInput()
  const [crossover1] = useParameter('xover1', { default: 200, min: 20, max: 2000, label: 'Low/Mid' })
  const [crossover2] = useParameter('xover2', { default: 4000, min: 500, max: 20000, label: 'Mid/High' })

  // Split into bands
  const low = useFilter(input, { type: 'lowpass', cutoff: crossover1 })
  const mid = useFilter(input, { type: 'bandpass', cutoff: crossover1, cutoffHigh: crossover2 })
  const high = useFilter(input, { type: 'highpass', cutoff: crossover2 })

  // Compress each band independently
  const compLow = useCompressor(low, { threshold: -20, ratio: 4, attack: 10, release: 100 })
  const compMid = useCompressor(mid, { threshold: -15, ratio: 3, attack: 5, release: 80 })
  const compHigh = useCompressor(high, { threshold: -10, ratio: 2, attack: 2, release: 50 })

  // Recombine
  const merged = useMerge(compLow, compMid, compHigh)
  useOutput(merged)

  return <MultibandCompressorUI />
}
```

### Instrument Plugins (MIDI → Audio)

```tsx
function SimpleSynth() {
  const midi = useMidi()
  const [waveform, setWaveform] = useParameter('wave', { default: 0, min: 0, max: 3, steps: 4, label: 'Waveform' })
  const [attack] = useParameter('attack', { default: 10, min: 0, max: 5000, label: 'Attack' })
  const [release] = useParameter('release', { default: 200, min: 0, max: 5000, label: 'Release' })
  const [cutoff] = useParameter('cutoff', { default: 2000, min: 20, max: 20000, label: 'Filter', curve: 'logarithmic' })

  const waveforms = ['sine', 'saw', 'square', 'triangle'] as const
  const osc = useOscillator(midi, { waveform: waveforms[waveform] })
  const env = useEnvelope(midi, { attack, decay: 0, sustain: 1, release })
  const shaped = useGain(osc, { gain: env })
  const filtered = useFilter(shaped, { type: 'lowpass', cutoff })
  useOutput(filtered)

  return (
    <Panel title="Synth">
      <Select label="Wave" options={['Sine', 'Saw', 'Square', 'Triangle']} value={waveform} onChange={setWaveform} />
      <Knob label="Attack" value={attack} unit="ms" />
      <Knob label="Release" value={release} unit="ms" />
      <Knob label="Filter" value={cutoff} unit="Hz" />
      <Keyboard />
    </Panel>
  )
}
```

### Metering & Visualization

The `useMeter` and `useSpectrum` hooks send analysis data back from the audio thread to JS for visualization:

```tsx
function AnalyzerPlugin() {
  const input = useInput()
  const meterData = useMeter(input, { type: 'rms', refreshRate: 30 })
  const spectrumData = useSpectrum(input, { fftSize: 2048, refreshRate: 30 })
  useOutput(input)  // Pass-through

  return (
    <Panel title="Analyzer">
      <Meter levels={meterData} />
      <Spectrum data={spectrumData} />
    </Panel>
  )
}
```

---

## State Persistence & Presets

Plugin state is automatically derived from `useParameter` hooks:

1. **Save**: The native harness calls `bridge.getState()` → JS serializes all parameter values to JSON → returned to host
2. **Recall**: The native harness calls `bridge.setState(json)` → JS parses JSON → updates all parameter states → React re-renders → audio graph updates

```typescript
// Automatic state management (framework-provided)
function usePluginState() {
  const parameters = useContext(ParameterRegistryContext)

  // Called by native harness on save
  bridge.onGetState(() => {
    return JSON.stringify(
      Object.fromEntries(
        parameters.entries().map(([id, param]) => [id, param.value])
      )
    )
  })

  // Called by native harness on recall
  bridge.onSetState((json: string) => {
    const state = JSON.parse(json)
    for (const [id, value] of Object.entries(state)) {
      parameters.get(id)?.setValue(value as number)
    }
  })
}
```

---

## Implementation Phases

### Phase 1: Core Foundation
- [ ] Virtual audio graph data structure and diff algorithm
- [ ] `useAudioNode` core hook
- [ ] JS ↔ C++ bridge protocol (JUCE WebView messaging)
- [ ] Native audio graph engine with topological sort
- [ ] Buffer pool and node processing pipeline
- [ ] Basic nodes: Gain, Delay, Filter (Biquad)
- [ ] `useInput`, `useOutput`, `useParameter` hooks
- [ ] Minimal standalone host for testing

### Phase 2: Developer Experience
- [ ] CLI scaffolding (`create`, `dev`, `build`)
- [ ] Vite-based dev server with HMR
- [ ] Production build pipeline (Vite bundle → JUCE BinaryData → CMake)
- [ ] UI component library (Knob, Slider, Meter)
- [ ] Hot-reloading of audio graph without glitches
- [ ] Parameter automation (host → JS → audio engine)

### Phase 3: Full DSP Library
- [ ] Oscillator, LFO, Envelope nodes
- [ ] Compressor, Limiter, Gate dynamics nodes
- [ ] Reverb (algorithmic + convolution)
- [ ] Distortion/Waveshaper
- [ ] Chorus, Flanger, Phaser
- [ ] Spectrum analysis, advanced metering
- [ ] MIDI input handling for instrument plugins
- [ ] Multi-channel support (mono, stereo, surround)

### Phase 4: Production Readiness
- [ ] Cross-platform build (macOS AU/VST3, Windows VST3/AAX)
- [ ] Plugin validation suite (auval, VST3 validator)
- [ ] State save/recall with host compatibility testing
- [ ] Preset system with import/export
- [ ] Performance profiling and optimization
- [ ] Comprehensive documentation and examples
- [ ] Custom DSP node authoring (C++ extension API)

---

## Technical Risks & Mitigations

| Risk                                            | Severity | Mitigation                                                                                 |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| WebView startup latency (plugin open time)      | Medium   | Pre-warm WebView pool; lazy UI load; show native splash while loading                      |
| WebView memory overhead (~30-50MB per instance) | Medium   | Acceptable for modern DAWs; consider shared WebView process for multiple instances         |
| Bridge latency for parameter updates            | Low      | Fast path: atomic writes bypass message queue; parameter smoothing in DSP hides latency    |
| Graph topology changes causing audio glitches   | Medium   | Double-buffered graph: build new graph while old one plays, atomic swap at buffer boundary |
| Cross-platform WebView inconsistencies          | Medium   | Test matrix; CSS normalization; feature detection; stick to well-supported APIs            |
| JUCE licensing (GPLv3 or commercial)            | Low      | Open-source under GPL; commercial users need JUCE license (standard in the industry)       |

---

## Prior Art & Inspiration

- **Elementary Audio**: Proved that JS-driven audio graph reconciliation works for plugins (SRVB reverb). Main difference: React Audio Unit uses React itself as the reconciler rather than a custom rendering function.
- **r-audio**: Demonstrated React components as Web Audio nodes. We extend this concept to native plugins.
- **JUCE 8 WebView**: Provides the production-grade WebView embedding we build on.
- **iPlug2 WebUI**: Validates the WebView-for-plugin-UI approach across formats.
- **React Three Fiber**: Architectural inspiration — a React renderer for a non-DOM target (Three.js/WebGL). We do the same for audio graphs.

---

## Summary

React Audio Unit lets plugin developers write **one React component** that defines both the audio signal flow (via hooks) and the plugin UI (via JSX). A custom reconciler translates the declarative audio graph description into operations on a native C++ DSP engine, while the UI renders in a JUCE-hosted WebView. This gives plugin developers the full power of the React ecosystem — components, hooks, state management, CSS, npm packages — while maintaining real-time audio performance through native processing.

The key insight is that **React's rules of hooks naturally enforce audio-safe patterns**: static graph topology with dynamic parameter values, which is exactly what professional audio plugins need.
