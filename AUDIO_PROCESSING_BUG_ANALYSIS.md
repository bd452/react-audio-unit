# Audio Processing Bug Analysis (ALL ISSUES FIXED)

After a deep review of the entire codebase (native C++ engine, JS/TS bridge + reconciler,
DSP hooks, and all example plugins), the following issues were identified that could cause
"audio processing and adjustment doesn't work" after compiling and loading the plugin.

Issues are ranked by **likelihood of being the root cause** and **severity**.

---

## 1. React StrictMode Tears Down the Audio Graph on Mount (CRITICAL)

**Likelihood: VERY HIGH in dev mode | Severity: TOTAL FAILURE**

Every example's `main.tsx` wraps the app in `<React.StrictMode>`:

```tsx
// examples/simple-gain/src/main.tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PluginHost>
      <Plugin />
    </PluginHost>
  </React.StrictMode>,
);
```

In **React 18 development mode**, StrictMode intentionally double-fires effects to expose
bugs. The `PluginHost` reconciliation effect (which has no dependency array) runs like this:

1. **First effect run**: Snapshots the virtual graph (which has all nodes registered during
   render), diffs `null → graph`, sends `addNode`/`connect`/`setOutput` ops to the native
   engine, then **clears the virtual graph** (`graphRef.current.clear()`).

2. **StrictMode re-fires the effect** (no render in between): Snapshots the virtual graph
   again — but it is now **empty** (cleared in step 1). Diffs `prev_graph → empty_graph`,
   generating `removeNode` ops for **every node**. Sends these to the native engine.

**Result**: The entire audio graph is built and immediately torn down. The native engine has
zero nodes. No audio processing occurs — the `processBlock` function returns early because
`snapshot->processingOrder` is empty. Audio passes through the plugin completely unprocessed
(or silence, depending on the path).

The graph may eventually be rebuilt when something triggers a React re-render (e.g., touching
a UI control), but the plugin starts broken.

**Affected code**:

```tsx
// packages/core/src/context.tsx — PluginHost reconciliation effect
useEffect(() => {
    const nextSnapshot = graphRef.current.snapshot();
    const { ops, paramOnly } = diffGraphsFull(
      prevSnapshotRef.current,
      nextSnapshot,
    );
    // ... send ops ...
    prevSnapshotRef.current = nextSnapshot;
    graphRef.current.clear();   // <-- graph is empty for the StrictMode re-fire
});
```

**Why this matters**: The CMakePresets "dev" preset does NOT define `RAU_WEB_UI_DIR`, so
`RAU_EMBEDDED_UI=0`, meaning the compiled plugin loads the UI from the Vite dev server
(`http://localhost:5173`). In dev mode, React StrictMode is active. This is the most likely
workflow for someone saying "after compiling and loading the example plugin."

**In production builds** (where the web UI is bundled by Vite with `NODE_ENV=production`),
StrictMode's double-effect behavior is disabled. So this bug only manifests in the
development workflow — but that IS the workflow described in the issue.

---

## 2. Parameter Name Mismatches Between JS Hooks and C++ Nodes (HIGH)

**Likelihood: 100% (definite bugs) | Severity: Specific adjustments silently have no effect**

The `AudioNodeBase::setParam()` method silently ignores unknown parameter names:

```cpp
void setParam(const std::string &name, float value) {
    auto it = params.find(name);
    if (it != params.end()) {
        it->second.store(value, std::memory_order_relaxed);
    }
    // SILENTLY DOES NOTHING if param name not found
}
```

Several JS hooks send parameter names that don't match what the C++ node registered:

### a) `useCompressor` sends `makeupDb` — CompressorNode has `makeupGain`

| JS hook (`useCompressor.ts`) | C++ node (`CompressorNode.cpp`) |
|---|---|
| `makeupDb: params.makeupDb ?? 0` | `addParam("makeupGain", 0.0f)` |

The compressor's makeup gain is **always 0 dB**. Users turning a makeup gain knob see no
effect.

### b) `useDistortion` sends `outputLevel` — DistortionNode has `outputGain`

| JS hook (`useDistortion.ts`) | C++ node (`DistortionNode.cpp`) |
|---|---|
| `outputLevel: params.outputLevel ?? 1` | `addParam("outputGain", 0.5f)` |

The distortion output level is **always stuck at 0.5** (the C++ default). The user-facing
`outputLevel` parameter is silently ignored, AND the default is 0.5 instead of the JS
default of 1.0 — meaning distortion output is at half volume with no way to change it.

### c) `useOscillator` sends `unison` — OscillatorNode has no `unison` param

The `unison` parameter is declared in the JS hook but not implemented in the C++ node.
`setParam("unison", ...)` does nothing. This is a missing feature rather than a mismatch,
but it contributes to "adjustment doesn't work."

### d) `useLFO` sends `tempoSync` — LFONode has no `tempoSync` param

Same as above. The `tempoSync` feature is declared in JS but not implemented in C++.

---

## 3. Thread Safety: Data Race on the `nodes` Map (HIGH)

**Likelihood: MEDIUM (race condition) | Severity: Crash, corruption, or silent failure**

The `AudioGraph::nodes` map (`std::unordered_map<std::string, std::unique_ptr<AudioNodeBase>>`)
is accessed from **two threads without synchronization**:

- **Message thread** writes to `nodes` in `queueOp()` (AddNode/RemoveNode)
- **Message thread** reads `nodes` in `setNodeParam()` (fast-path param updates)
- **Audio thread** reads `nodes` in `applyPendingOps()` (SPSC queue drain)
- **Message thread** reads `nodes` in `getNode()` and `getNodesByType()` (analysis)

`std::unordered_map` is NOT thread-safe for concurrent access when any thread modifies it.
If `queueOp()` adds/removes a node while `applyPendingOps()` is iterating the map, this is
**undefined behavior** (data race per C++ standard).

The impact ranges from silent parameter drops (audio processing seems broken) to crashes.
The race is narrow, so it manifests intermittently rather than consistently.

---

## 4. Channel-Strip Example: Conditional Hook Violates Rules of Hooks (HIGH for that example)

**Likelihood: 100% | Severity: React crash or unpredictable behavior**

```tsx
// examples/channel-strip/src/Plugin.tsx
const afterHP =
  hpOn > 0.5
    ? useFilter(input, { type: "highpass", cutoff: hpFreq, resonance: 0.707 })
    : input;
```

`useFilter` calls `useAudioNode` which calls `useRef` and `useMemo`. Calling hooks
conditionally violates React's Rules of Hooks. When `hpOn` transitions across 0.5, the
number of hook calls changes, causing React to either throw an error or produce corrupted
state.

The project's own SUMMARY.md explicitly warns against this pattern. This bug would cause
the channel-strip example to malfunction when toggling the HP filter.

---

## 5. `processBlock` Passes Full Buffer Instead of Main Bus Buffer (MEDIUM)

**Likelihood: LOW for basic examples, HIGH with sidechain | Severity: Incorrect audio routing**

```cpp
// packages/native/src/PluginProcessor.cpp — processBlock()
auto mainBuffer = getBusBuffer(buffer, true, 0);  // Created but NEVER USED
audioGraph.processBlock(buffer, midi);             // Passes the FULL buffer
```

`mainBuffer` is extracted via `getBusBuffer` but then ignored. The full `buffer` (which
includes sidechain channels when that bus is enabled) is passed to the audio graph. This
means:

- The input node exposes ALL channels (main + sidechain) as its output
- The final output is written to ALL channels, potentially corrupting sidechain data

For basic stereo-only examples (no sidechain), `buffer` and `mainBuffer` are identical,
so this doesn't cause an issue. But it indicates the intent was to pass `mainBuffer`.

---

## 6. Subtractive Synth: Envelope Units Mismatch (MEDIUM)

**Likelihood: 100% | Severity: Envelope is essentially instant**

The synth example passes envelope times in **seconds**:

```tsx
// examples/subtractive-synth/src/Plugin.tsx
const [attack, setAttack] = useParameter("env_attack", {
  default: 0.01,   // 0.01 seconds = 10ms
  min: 0.001,      // 1ms
  max: 2.0,        // 2s
  ...
});
const env = useEnvelope(midi, { attack, decay, sustain, release });
```

But `useEnvelope`'s TypeScript interface says `/** Attack time in ms. */` and the C++
`EnvelopeNode` treats the value as milliseconds:

```cpp
const float attackRate = 1.0f / (attackMs * 0.001f * sr);
```

With `attack = 0.01` interpreted as 0.01ms, the attack completes in < 1 sample. The
envelope is essentially a step function — no audible attack/decay/release shaping.

---

## 7. Channel-Strip: Compressor Attack/Release Division Error (MEDIUM)

**Likelihood: 100% | Severity: Compressor attack/release 1000x too fast**

```tsx
// examples/channel-strip/src/Plugin.tsx
const afterComp = useCompressor(afterHigh, {
  threshold,
  ratio,
  attack: compAttack / 1000,   // Comment says "ms → seconds" but
  release: compRelease / 1000, // useCompressor expects ms!
  makeupDb: makeup,
});
```

The `useCompressor` interface documents `attack` and `release` in **milliseconds**. The
channel-strip divides by 1000, making them 1000x too short. A 10ms attack becomes 0.01ms.

---

## 8. ConvolverNode Allocates on Audio Thread (MEDIUM)

**Likelihood: 100% when convolver is used | Severity: Audio glitches/dropouts**

```cpp
// packages/native/src/nodes/ConvolverNode.cpp
void ConvolverNode::process(int numSamples) {
    // ...
    juce::AudioBuffer<float> wetBuffer(numCh, numSamples); // HEAP ALLOCATION
    // ...
}
```

Heap allocation on the audio thread violates real-time safety and can cause priority
inversion, page faults, or lock contention — all of which produce audio glitches.

---

## 9. `std::atomic<float>` in `std::unordered_map` — Latent UB (LOW)

**Likelihood: LOW (depends on param count) | Severity: Compilation failure or crash**

`AudioNodeBase` stores params as `std::unordered_map<std::string, std::atomic<float>>`.
`std::atomic` is neither copyable nor movable. If the map rehashes (load factor exceeds
threshold), rehashing needs to move elements — which is impossible for `std::atomic`.

Currently works because nodes have few params (2-7) and the default bucket count (~10) is
sufficient. But adding more params to a node could trigger rehashing and crash.

---

## 10. Intermediate Graph Snapshots Visible to Audio Thread (LOW)

**Likelihood: LOW (narrow race window) | Severity: Brief audio glitch**

Each topology operation in a batch calls `rebuildAndPublishSnapshot()`. If the audio thread
reads a snapshot between ops (e.g., after `addNode` but before `connect`), it sees a
partially-constructed graph. A node without its connections would produce silence or use
stale buffers for one block.

---

## 11. LFO Uses `rand()` on Audio Thread (LOW)

**Likelihood: LOW | Severity: Occasional audio glitch**

`LFONode::process()` calls `rand()` for the random S&H waveform. `rand()` is not
thread-safe (uses global state) and may acquire a lock internally, violating real-time
safety.

---

## Evaluation Summary

| # | Issue | Likelihood | Severity | Affects |
|---|---|---|---|---|
| 1 | StrictMode double-effect graph teardown | **VERY HIGH** (dev mode) | **Total failure** | All examples |
| 2 | Parameter name mismatches (JS ↔ C++) | **100%** | **Specific params broken** | Compressor, Distortion, Oscillator, LFO |
| 3 | Data race on `nodes` map | **Medium** | **Crash/corruption** | All examples (intermittent) |
| 4 | Conditional hook in channel-strip | **100%** | **React crash** | Channel-strip only |
| 5 | Full buffer vs main buffer in processBlock | **Low** (basic examples) | **Wrong routing** | Sidechain scenarios |
| 6 | Synth envelope units mismatch | **100%** | **Instant envelope** | Subtractive synth |
| 7 | Channel-strip compressor unit conversion | **100%** | **Instant dynamics** | Channel-strip only |
| 8 | ConvolverNode audio-thread allocation | **100%** (when used) | **Glitches** | Convolver usage |
| 9 | `atomic` in `unordered_map` rehash | **Low** | **Crash** | Nodes with many params |
| 10 | Intermediate snapshot race | **Low** | **Brief glitch** | All examples |
| 11 | `rand()` on audio thread | **Low** | **Brief glitch** | LFO random mode |

---

## Most Likely Root Cause

**Issue #1 (React StrictMode)** is overwhelmingly the most likely root cause for the
reported symptom "audio processing and adjustment doesn't work" in the development workflow.
It produces a complete, reproducible failure: the audio graph is set up then immediately
torn down, resulting in no audio processing whatsoever.

**Issue #2 (parameter name mismatches)** is the second most impactful — even once the graph
is running, several parameters silently do nothing because the JS and C++ sides disagree on
parameter names. This would manifest as "adjustment doesn't work" for specific controls.

**Issue #3 (thread safety)** is a latent correctness issue that could produce intermittent
failures, but is less likely to be the consistent "doesn't work" described in the report.

---

## All Fixes Applied

All 11 issues have been fixed:

1. **StrictMode**: Added `isDirty()` flag to `VirtualAudioGraph`; PluginHost effect skips when no render happened.
2. **Param names**: Created `packages/dsp/src/param-keys.ts` as single source of truth; fixed `makeupGain`→`makeupDb`, `outputLevel`→`outputGain`, removed phantom `unison`/`tempoSync`.
3. **Thread safety**: `applyPendingOps` now uses `GraphSnapshot::nodeMap` instead of the shared `nodes` map.
4. **Conditional hook**: Channel-strip HP filter uses `bypass` param instead of conditional `useFilter`.
5. **Buffer routing**: `processBlock` passes `mainBuffer` (from `getBusBuffer`) instead of full multi-bus buffer.
6. **Envelope units**: Synth example uses ms (10/200/300) instead of seconds (0.01/0.2/0.3).
7. **Compressor units**: Channel-strip removed `/1000` division on attack/release.
8. **ConvolverNode**: Wet buffer pre-allocated in `prepare()`.
9. **AtomicFloat**: Introduced move-safe `AtomicFloat` wrapper for the parameter map.
10. **Batch ops**: Added `AudioGraph::queueOps()` — snapshot rebuilds once per batch, not per op.
11. **LFO PRNG**: Replaced `rand()` with deterministic xorshift32.
