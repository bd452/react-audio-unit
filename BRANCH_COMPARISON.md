# Branch Comparison Analysis

Comparison of three fix branches that address audio processing issues in the
react-audio-unit plugin framework.

| Branch | PR | Commits | Files Changed |
|---|---|---|---|
| `cursor/echo-delay-plugin-audio-issue-e394` | #4 "Echo-delay plugin audio issue" | 2 | 2 |
| `cursor/plugin-audio-processing-issue-6e67` | #3 "Plugin audio processing issue" | 6 | 21 |
| `cursor/echo-delay-plugin-issue-77e3` | #5 "Echo-delay plugin issue" | 1 | 7 |

---

## Branch Summaries

### Branch e394 — Narrow, targeted fix (2 files)

**Scope:** Fast-path parameter reconciliation + plugin tail length.

Changes:
1. **`packages/core/src/context.tsx`** — Fixes the fast-path parameter reconciliation that
   silently dropped boolean and string parameters. Before this fix, only `typeof value ===
   "number"` values were forwarded via `sendParamUpdate`; booleans (e.g. bypass toggles)
   and string enums (e.g. filter type) were silently lost. The fix:
   - Converts booleans to `0`/`1` before sending.
   - Falls back to the full `sendGraphOps` path when any param value is a string.
2. **`packages/native/src/PluginProcessor.h`** — Changes `getTailLengthSeconds()` from
   `0.0` to `5.0` so DAWs don't cut off delay/reverb tails prematurely.

### Branch 6e67 — Comprehensive deep fix (21 files)

**Scope:** Full codebase audit addressing 11 distinct bugs across native C++, JS bridge,
DSP hooks, and example plugins. Includes a detailed analysis document.

Key changes:
1. **React StrictMode graph teardown (CRITICAL)** — Adds an `isDirty()` flag to
   `VirtualAudioGraph`. The reconciliation effect skips when the graph hasn't been modified
   by a render cycle, preventing StrictMode's double-effect from tearing down the entire
   audio graph on mount.
2. **Parameter name mismatches** — Creates `packages/dsp/src/param-keys.ts` as a single
   source of truth for JS↔C++ parameter names. Fixes:
   - `makeupDb` (JS) vs `makeupGain` (C++) on CompressorNode
   - `outputLevel` (JS) vs `outputGain` (C++) on DistortionNode
   - Removes phantom `unison` param from useOscillator
   - Removes phantom `tempoSync` param from useLFO
3. **Thread safety** — `applyPendingOps()` on the audio thread now uses
   `GraphSnapshot::nodeMap` (a raw-pointer lookup table) instead of the authoritative
   `nodes` map owned by the message thread, eliminating a data race.
4. **Conditional hook violation** — Channel-strip example's conditional `useFilter` call
   replaced with a `bypass` parameter approach, complying with React's Rules of Hooks.
5. **processBlock buffer routing** — Passes `mainBuffer` (from `getBusBuffer`) instead of
   the full multi-bus buffer, preventing sidechain channel corruption.
6. **Envelope units** — Subtractive synth example now passes envelope times in milliseconds
   (matching the C++ EnvelopeNode's expectation) instead of seconds.
7. **Compressor units** — Channel-strip example removes erroneous `/1000` division on
   attack/release (they're already in ms).
8. **ConvolverNode allocation** — Pre-allocates the wet buffer in `prepare()` instead of
   allocating on the audio thread.
9. **AtomicFloat wrapper** — Introduces a move-safe `AtomicFloat` struct so
   `std::unordered_map<string, AtomicFloat>` can safely rehash.
10. **Batch graph ops** — Adds `AudioGraph::queueOps()` to apply all topology ops before
    rebuilding the snapshot once, preventing the audio thread from seeing intermediate states.
11. **LFO PRNG** — Replaces `rand()` with a deterministic xorshift32 PRNG for thread safety
    on the audio thread.
12. **Fast-path param fix** — Similar to e394: non-numeric params (string/bool) fall back
    to `sendGraphOps` instead of being silently dropped. However, the implementation differs
    in that it sends non-numeric params via `bridge.sendGraphOps(fallbackOps)` per-op rather
    than checking all ops upfront.

### Branch 77e3 — Bridge transport + reconciliation fix (7 files)

**Scope:** JS↔C++ bridge communication reliability, StrictMode reconciliation, and build/UI
robustness.

Key changes:
1. **WebViewBridge overhaul** — Replaces `withNativeFunction("rau_js_message", ...)` with
   `withNativeIntegrationEnabled()` + `withEventListener("rau_js_message", ...)`. This is
   the most critical fix — the original `withNativeFunction` API registers a callable
   function but JUCE's `emitEvent()` dispatches to **event listeners**, not native functions.
   The JS side calls `emitEvent("rau_js_message", payload)` but the C++ side was listening
   via `withNativeFunction`, meaning **no messages ever reached C++**. This would cause
   total audio failure (dry signal only).
2. **NativeBridge queuing** — Adds `pendingMessages` queue with retry timer to handle the
   case where the JUCE backend object isn't ready when the first graph ops are sent.
   Prevents lost messages during initialization.
3. **StrictMode reconciliation** — Moves `graphRef.current.clear()` from the end of the
   effect to the beginning of the render function body, making the graph collection
   idempotent under StrictMode's double-effect.
4. **Fast-path param fix** — Same issue as e394/6e67: non-numeric params fall back to
   `sendGraphOps`. Implementation splits ops into numeric-only (fast path) and non-numeric
   (fallback to graphOps).
5. **Dev bridge guard** — Only installs the dev bridge in browser preview mode
   (`http:`/`https:` protocol), preventing it from interfering in JUCE WebView contexts.
6. **Build validation** — CLI build command checks for `dist/ui/index.html` after Vite
   build, failing fast with a clear error if the UI output is missing.
7. **PluginEditor fallback** — In non-embedded, non-debug builds, shows a helpful error
   message instead of silently trying to connect to `localhost:5173`.

---

## Overlap Analysis

### File overlap

The only file modified by all three branches is **`packages/core/src/context.tsx`**. Each
branch makes changes to the reconciliation logic in `PluginHost`:

| Issue | e394 | 6e67 | 77e3 |
|---|---|---|---|
| Fast-path drops boolean params | Yes (converts to 0/1) | Yes (falls back to graphOps) | Yes (falls back to graphOps) |
| Fast-path drops string params | Yes (falls back to full path) | Yes (falls back to graphOps) | Yes (falls back to graphOps) |
| StrictMode double-effect teardown | **No** | Yes (`isDirty()` flag) | Yes (moves `clear()` to render) |

All three branches fix the **same fast-path parameter reconciliation bug** (non-numeric
params silently dropped), but with slightly different implementations.

Only 6e67 and 77e3 fix the **StrictMode teardown bug**, using different approaches:
- 6e67 adds a `_dirty` flag to `VirtualAudioGraph` and skips the effect when not dirty.
- 77e3 moves `graphRef.current.clear()` to the render body so re-fired effects see the
  same (already-collected) graph.

No other files overlap between branches.

---

## Correctness Assessment

### Which branches solve the relevant issues properly?

#### Branch e394 — PARTIALLY CORRECT

**Properly fixes:**
- Boolean/string parameter fast-path issue (the direct trigger for "adjustments don't work")
- Plugin tail length for delay effects

**Does NOT fix:**
- The React StrictMode graph teardown bug (the most critical issue causing "audio processing
  doesn't work" in dev mode — the entire graph gets built then immediately destroyed)
- The JS↔C++ bridge communication mismatch (`withNativeFunction` vs `emitEvent`), if that
  bug exists in the target JUCE version
- Any C++ side issues (thread safety, parameter name mismatches, allocation on audio thread)

**Verdict:** This branch fixes a real symptom (parameter adjustments not working) but misses
the root cause of total audio failure. It would help if audio was already flowing but
parameters weren't responding — but if the graph is torn down by StrictMode or messages never
reach C++, these fixes alone aren't sufficient.

#### Branch 6e67 — MOST COMPREHENSIVE, CORRECT

**Properly fixes:**
- StrictMode graph teardown (critical root cause)
- Parameter name mismatches (definite bugs causing specific controls to silently fail)
- Thread safety on `nodes` map (latent data race)
- Conditional hook violation in channel-strip example
- Buffer routing (`mainBuffer` vs full buffer)
- Example-level unit mismatches (envelope seconds vs ms, compressor double-conversion)
- Audio-thread allocation in ConvolverNode
- `AtomicFloat` rehash safety
- Batch graph ops (intermediate snapshot race)
- LFO `rand()` thread safety
- Fast-path non-numeric parameter handling

**Does NOT fix:**
- The JS↔C++ bridge transport mismatch (`withNativeFunction` vs `emitEvent`) — this branch
  assumes the bridge communication works and focuses on what happens after messages arrive
- Plugin tail length for delays
- Message queuing during bridge initialization

**Verdict:** This is the most thorough branch by far. It addresses the StrictMode root cause
plus 10 additional bugs found via deep codebase audit. However, if the fundamental bridge
transport is broken (messages from JS never reach C++ because `emitEvent` dispatches to
event listeners, not native functions), then none of these fixes matter because no graph
ops ever execute on the native side. This depends on the JUCE version and API being used.

#### Branch 77e3 — FIXES THE DEEPEST ROOT CAUSE

**Properly fixes:**
- **JS↔C++ bridge transport mismatch** — This is potentially the single most critical fix.
  If `window.__JUCE__.backend.emitEvent()` dispatches to event listeners (not native
  functions), then the original `withNativeFunction("rau_js_message", ...)` registration
  means C++ never receives ANY messages from JS. Changing to `withEventListener` fixes this.
- StrictMode graph teardown (via moving `clear()` to render body)
- Fast-path non-numeric parameter handling
- Bridge initialization race (message queuing with retry)
- Dev bridge interference in JUCE context
- Build validation and UI fallback

**Does NOT fix:**
- Parameter name mismatches (JS `makeupDb` vs C++ `makeupGain`, etc.)
- Thread safety on `nodes` map
- Conditional hook violation
- Buffer routing, envelope/compressor unit mismatches
- Audio-thread allocation, AtomicFloat, batch ops, LFO PRNG
- Plugin tail length

**Verdict:** If the `withNativeFunction` vs `withEventListener` mismatch is real (i.e., the
JUCE API version in use requires event listeners for `emitEvent`), then this branch fixes
the absolute deepest root cause — without it, no other fix matters because native C++ never
receives any messages. The StrictMode fix and bridge queuing are also important correctness
improvements. However, this branch doesn't address any of the C++-side bugs or parameter
name mismatches that 6e67 covers.

---

## Recommendation

**All three branches address real bugs, but they target different layers of the stack with
significant overlap in one area (fast-path parameter reconciliation in `context.tsx`).**

The ideal resolution would combine:

1. **From 77e3:** The bridge transport fix (`withNativeFunction` → `withEventListener`),
   message queuing, dev-bridge guard, build validation, and UI fallback. These are unique
   to this branch and address the communication layer.

2. **From 6e67:** The StrictMode `isDirty()` fix (more robust than 77e3's approach of moving
   `clear()` to render), parameter name mismatches, thread safety, conditional hook fix,
   buffer routing, example unit fixes, ConvolverNode allocation, AtomicFloat, batch ops, and
   LFO PRNG. These are deep correctness fixes unique to this branch.

3. **From e394:** The tail length fix (`getTailLengthSeconds() → 5.0`) which is unique to
   this branch and important for delay plugins.

The fast-path parameter reconciliation fix exists in all three branches — any of the three
implementations would work, though 6e67's per-op fallback and e394's boolean→number
conversion are both reasonable approaches.

### Summary Table

| Fix | e394 | 6e67 | 77e3 | Needed? |
|---|---|---|---|---|
| Fast-path non-numeric params | **Yes** | **Yes** | **Yes** | Yes (overlap) |
| Plugin tail length (5s) | **Yes** | No | No | Yes (unique to e394) |
| StrictMode graph teardown | No | **Yes** | **Yes** | Yes (overlap) |
| Bridge transport (native fn → event listener) | No | No | **Yes** | Critical (unique to 77e3) |
| Bridge message queuing | No | No | **Yes** | Yes (unique to 77e3) |
| Dev bridge guard | No | No | **Yes** | Yes (unique to 77e3) |
| Build validation + UI fallback | No | No | **Yes** | Nice-to-have (unique to 77e3) |
| Parameter name mismatches (4 bugs) | No | **Yes** | No | Yes (unique to 6e67) |
| Thread safety (nodes map race) | No | **Yes** | No | Yes (unique to 6e67) |
| Conditional hook violation | No | **Yes** | No | Yes (unique to 6e67) |
| processBlock buffer routing | No | **Yes** | No | Yes (unique to 6e67) |
| Example unit mismatches (2 bugs) | No | **Yes** | No | Yes (unique to 6e67) |
| ConvolverNode audio-thread alloc | No | **Yes** | No | Yes (unique to 6e67) |
| AtomicFloat rehash safety | No | **Yes** | No | Yes (unique to 6e67) |
| Batch graph ops | No | **Yes** | No | Yes (unique to 6e67) |
| LFO PRNG thread safety | No | **Yes** | No | Yes (unique to 6e67) |
| param-keys.ts (single source of truth) | No | **Yes** | No | Yes (unique to 6e67) |
