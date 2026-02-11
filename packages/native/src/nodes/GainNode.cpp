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

        if (smoothedGain.isSmoothing())
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
