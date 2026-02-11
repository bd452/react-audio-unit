#include "DelayNode.h"
#include <cmath>

namespace rau
{

    DelayNode::DelayNode()
    {
        nodeType = "delay";
        addParam("time", 500.0f);   // ms
        addParam("feedback", 0.0f); // 0–1
        addParam("mix", 1.0f);      // dry/wet
        addParam("bypass", 0.0f);
    }

    void DelayNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);

        // Allocate delay buffer for max delay time
        delayBufferSize = static_cast<int>(std::ceil(MAX_DELAY_MS * sr / 1000.0)) + 1;
        delayBuffer.resize(2); // stereo
        for (auto &ch : delayBuffer)
        {
            ch.assign(delayBufferSize, 0.0f);
        }
        writePos = 0;

        smoothedTime.reset(sr, 0.05); // 50ms smoothing for delay time changes
        smoothedTime.setCurrentAndTargetValue(getParam("time"));
    }

    void DelayNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        const float feedback = juce::jlimit(0.0f, 0.95f, getParam("feedback"));
        const float mix = juce::jlimit(0.0f, 1.0f, getParam("mix"));
        smoothedTime.setTargetValue(getParam("time"));

        for (int s = 0; s < numSamples; ++s)
        {
            const float delayMs = smoothedTime.getNextValue();
            const float delaySamples = static_cast<float>(delayMs * sampleRate / 1000.0);

            // Read position with linear interpolation
            float readPosF = static_cast<float>(writePos) - delaySamples;
            if (readPosF < 0.0f)
                readPosF += static_cast<float>(delayBufferSize);

            const int readPos0 = static_cast<int>(readPosF) % delayBufferSize;
            const int readPos1 = (readPos0 + 1) % delayBufferSize;
            const float frac = readPosF - std::floor(readPosF);

            for (int ch = 0; ch < numChannels && ch < 2; ++ch)
            {
                const float dry = in.getSample(ch, s);

                // Interpolated read from delay buffer
                const float delayed = delayBuffer[ch][readPos0] * (1.0f - frac) + delayBuffer[ch][readPos1] * frac;

                // Write input + feedback to delay buffer
                delayBuffer[ch][writePos] = dry + delayed * feedback;

                // Output: dry/wet mix
                out.setSample(ch, s, dry * (1.0f - mix) + delayed * mix);
            }

            writePos = (writePos + 1) % delayBufferSize;
        }
    }

} // namespace rau
