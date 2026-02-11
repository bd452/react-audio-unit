#include "GainNode.h"

namespace rau
{

    GainNode::GainNode()
    {
        nodeType = "gain";
        addParam("gain", 1.0f);
        addParam("bypass", 0.0f);
    }

    void GainNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        smoothedGain.reset(sr, 0.02); // 20ms smoothing
        smoothedGain.setCurrentAndTargetValue(getParam("gain"));
    }

    void GainNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        smoothedGain.setTargetValue(getParam("gain"));

        // Check for amplitude modulation input (e.g. envelope on inlet 1).
        // When present, multiply audio (input 0) by modulation (input 1)
        // sample-by-sample, then scale by the gain parameter.
        if (inputBuffers.size() >= 2 && inputBuffers[1].isValid())
        {
            auto &mod = *inputBuffers[1].buffer;

            for (int s = 0; s < numSamples; ++s)
            {
                const float g = smoothedGain.getNextValue();
                // Read modulation value from first channel of mod input
                const float modVal = mod.getSample(0, s);

                for (int ch = 0; ch < numChannels; ++ch)
                {
                    out.setSample(ch, s, in.getSample(ch, s) * modVal * g);
                }
            }
        }
        else if (smoothedGain.isSmoothing())
        {
            for (int s = 0; s < numSamples; ++s)
            {
                const float g = smoothedGain.getNextValue();
                for (int ch = 0; ch < numChannels; ++ch)
                {
                    out.setSample(ch, s, in.getSample(ch, s) * g);
                }
            }
        }
        else
        {
            const float g = smoothedGain.getCurrentValue();
            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.copyFrom(ch, 0, in, ch, 0, numSamples);
                out.applyGain(ch, 0, numSamples, g);
            }
        }
    }

} // namespace rau
