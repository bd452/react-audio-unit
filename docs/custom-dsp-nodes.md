# Custom DSP Node Authoring Guide

This guide explains how to add your own C++ DSP nodes to React Audio Unit and expose them to JavaScript via hooks.

## Architecture Overview

Every DSP node has two parts:
1. **C++ implementation** — real-time audio processing (`packages/native/src/nodes/`)
2. **JS hook** — React hook that registers the node in the virtual audio graph (`packages/dsp/src/hooks/`)

The bridge between them is the node's **type string** (e.g. `"gain"`, `"delay"`, `"myCustomNode"`).

## Step 1: Create the C++ Node

### Header file

Create `packages/native/src/nodes/MyNode.h`:

```cpp
#pragma once
#include "NodeBase.h"
#include <juce_dsp/juce_dsp.h>  // if you need JUCE DSP classes

namespace rau
{

class MyNode : public AudioNodeBase
{
public:
    MyNode();
    ~MyNode() override = default;

    void prepare(double sampleRate, int maxBlockSize) override;
    void process(int numSamples) override;
    void setParam(const std::string &name, float value) override;

private:
    // Your DSP state
    std::atomic<float> myParam{0.5f};
    juce::SmoothedValue<float> smoothedParam;
    double sr = 44100.0;
};

} // namespace rau
```

### Implementation file

Create `packages/native/src/nodes/MyNode.cpp`:

```cpp
#include "MyNode.h"

namespace rau
{

MyNode::MyNode() = default;

void MyNode::prepare(double sampleRate, int maxBlockSize)
{
    sr = sampleRate;
    smoothedParam.reset(sampleRate, 0.02);  // 20ms smoothing
    smoothedParam.setCurrentAndTargetValue(myParam.load());
}

void MyNode::process(int numSamples)
{
    // Read the latest parameter value (atomic)
    smoothedParam.setTargetValue(myParam.load());

    // Get input buffer (inlet 0)
    auto &inBuf = inputBuffers[0];
    if (!inBuf.isValid()) return;

    auto &outBuf = *outputBuffer.buffer;
    int numCh = std::min(inBuf.buffer->getNumChannels(),
                         outBuf.getNumChannels());

    for (int s = 0; s < numSamples; ++s)
    {
        float paramVal = smoothedParam.getNextValue();

        for (int ch = 0; ch < numCh; ++ch)
        {
            float sample = inBuf.buffer->getSample(ch, s);
            // Your DSP processing here
            float processed = sample * paramVal;
            outBuf.setSample(ch, s, processed);
        }
    }
}

void MyNode::setParam(const std::string &name, float value)
{
    if (name == "myParam")
        myParam.store(value);
    else if (name == "bypass")
        setBypass(value > 0.5f);
}

} // namespace rau
```

### Key patterns

- **Parameters use `std::atomic<float>`** — the audio thread reads them, the message thread writes them.
- **Use `juce::SmoothedValue`** for parameters that affect gain/frequency to avoid zipper noise.
- **Access inputs via `inputBuffers[inlet]`** — inlet 0 is the first connection, inlet 1 is the second (e.g. sidechain).
- **Write output to `outputBuffer.buffer`** — the buffer is pre-allocated from the pool.
- **`prepare()` is called once** when the audio engine starts (and when sample rate changes).
- **`process()` is called on the audio thread** — no allocations, no locks, no blocking.

## Step 2: Register in NodeFactory

Edit `packages/native/src/nodes/NodeFactory.cpp`:

```cpp
#include "MyNode.h"

// In the create() method:
if (type == "myCustomNode")
    return std::make_unique<MyNode>();
```

## Step 3: Add to CMakeLists.txt

Edit `packages/native/CMakeLists.txt`, add to `target_sources`:

```cmake
${RAU_NATIVE_SRC_DIR}/nodes/MyNode.cpp
```

## Step 4: Create the JS Hook

Create `packages/dsp/src/hooks/useMyNode.ts`:

```typescript
import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface MyNodeParams {
  myParam: number;
  bypass?: boolean;
}

/**
 * useMyNode — does something cool to the audio.
 */
export function useMyNode(input: Signal, params: MyNodeParams): Signal {
  return useAudioNode(
    "myCustomNode",  // must match the C++ factory string
    {
      myParam: params.myParam,
      bypass: params.bypass ?? false,
    },
    [input],  // inlet connections: [inlet0, inlet1, ...]
  );
}
```

### Multiple inputs

If your node has multiple inputs (like a sidechain compressor):

```typescript
export function useMyNode(input: Signal, sidechain: Signal, params: MyNodeParams): Signal {
  return useAudioNode(
    "myCustomNode",
    { myParam: params.myParam },
    [input, sidechain],  // inlet 0 = input, inlet 1 = sidechain
  );
}
```

### Generator nodes (no input)

For nodes that generate audio (like oscillators):

```typescript
export function useMyGenerator(params: GeneratorParams): Signal {
  return useAudioNode("myGenerator", { frequency: params.frequency });
  // No input array = no inlet connections
}
```

## Step 5: Export the Hook

Add to `packages/dsp/src/index.ts`:

```typescript
export { useMyNode } from "./hooks/useMyNode.js";
export type { MyNodeParams } from "./hooks/useMyNode.js";
```

## Step 6: Build and Test

```bash
# Rebuild the native plugin
pnpm build

# Or use dev mode for faster iteration
pnpm dev -- --host
```

## String Parameter Conversion

If your node uses string-typed parameters (e.g. filter type, waveform), add conversion entries in `PluginProcessor.cpp`'s `stringParamToFloat()`:

```cpp
if (paramName == "myMode")
{
    if (value == "fast") return 0.0f;
    if (value == "slow") return 1.0f;
    return 0.0f;
}
```

## Thread Safety Rules

1. **Never allocate memory in `process()`** — pre-allocate in `prepare()` or the constructor.
2. **Use atomics for parameters** — `std::atomic<float>` for simple values.
3. **Use `SmoothedValue` for audible parameters** — prevents clicks and zipper noise.
4. **No mutexes in `process()`** — the audio thread must never block.
5. **`prepare()` runs on the message thread** — safe to allocate here.

## Example: Complete Waveshaper Node

See `packages/native/src/nodes/DistortionNode.h/cpp` for a complete example that demonstrates:
- Multiple distortion algorithms
- String enum parameter (`distortionType`)
- Input/output level controls
- Dry/wet mixing
- `SmoothedValue` for all parameters
