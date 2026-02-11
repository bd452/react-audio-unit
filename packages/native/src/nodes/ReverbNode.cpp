#include "ReverbNode.h"
#include <cmath>

namespace rau
{

    ReverbNode::ReverbNode()
    {
        nodeType = "reverb";
        addParam("roomSize", 0.5f);
        addParam("damping", 0.5f);
        addParam("preDelay", 0.0f); // ms (0–250)
        addParam("mix", 0.3f);
        addParam("bypass", 0.0f);
    }

    void ReverbNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        reverb.setSampleRate(sr);
        reverb.reset();

        // Allocate pre-delay buffer for max pre-delay time
        preDelayBufferSize = static_cast<int>(std::ceil(MAX_PRE_DELAY_MS * sr / 1000.0)) + 1;
        preDelayBuffer.resize(2); // stereo
        for (auto &ch : preDelayBuffer)
        {
            ch.assign(preDelayBufferSize, 0.0f);
        }
        preDelayWritePos = 0;

        smoothedPreDelay.reset(sr, 0.05); // 50ms smoothing
        smoothedPreDelay.setCurrentAndTargetValue(getParam("preDelay"));
    }

    void ReverbNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        // Update reverb parameters from atomics
        reverbParams.roomSize = juce::jlimit(0.0f, 1.0f, getParam("roomSize"));
        reverbParams.damping = juce::jlimit(0.0f, 1.0f, getParam("damping"));
        reverbParams.wetLevel = juce::jlimit(0.0f, 1.0f, getParam("mix"));
        reverbParams.dryLevel = 1.0f - reverbParams.wetLevel;
        reverbParams.width = 1.0f;
        reverbParams.freezeMode = 0.0f;
        reverb.setParameters(reverbParams);

        const float preDelayMs = juce::jlimit(0.0f, MAX_PRE_DELAY_MS, getParam("preDelay"));
        smoothedPreDelay.setTargetValue(preDelayMs);

        if (preDelayMs < 0.01f && !smoothedPreDelay.isSmoothing())
        {
            // No pre-delay: process directly (fast path)
            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.copyFrom(ch, 0, in, ch, 0, numSamples);
            }
        }
        else
        {
            // Apply pre-delay via circular buffer
            for (int s = 0; s < numSamples; ++s)
            {
                const float currentPreDelayMs = smoothedPreDelay.getNextValue();
                const float delaySamples = static_cast<float>(currentPreDelayMs * sampleRate / 1000.0);

                // Read position with linear interpolation
                float readPosF = static_cast<float>(preDelayWritePos) - delaySamples;
                if (readPosF < 0.0f)
                    readPosF += static_cast<float>(preDelayBufferSize);

                const int readPos0 = static_cast<int>(readPosF) % preDelayBufferSize;
                const int readPos1 = (readPos0 + 1) % preDelayBufferSize;
                const float frac = readPosF - std::floor(readPosF);

                for (int ch = 0; ch < numChannels && ch < 2; ++ch)
                {
                    const float sample = in.getSample(ch, s);

                    // Write to pre-delay buffer
                    preDelayBuffer[ch][preDelayWritePos] = sample;

                    // Interpolated read
                    const float delayed = preDelayBuffer[ch][readPos0] * (1.0f - frac) +
                                          preDelayBuffer[ch][readPos1] * frac;

                    out.setSample(ch, s, delayed);
                }

                preDelayWritePos = (preDelayWritePos + 1) % preDelayBufferSize;
            }
        }

        // Process reverb in-place on the (pre-delayed) output buffer
        if (numChannels >= 2)
        {
            reverb.processStereo(out.getWritePointer(0), out.getWritePointer(1), numSamples);
        }
        else if (numChannels == 1)
        {
            reverb.processMono(out.getWritePointer(0), numSamples);
        }
    }

} // namespace rau
