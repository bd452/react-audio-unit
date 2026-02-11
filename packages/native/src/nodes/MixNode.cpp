#include "MixNode.h"

namespace rau
{

    MixNode::MixNode()
    {
        nodeType = "mix";
        addParam("mix", 0.5f);
        addParam("bypass", 0.0f);
    }

    void MixNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        smoothedMix.reset(sr, 0.02);
        smoothedMix.setCurrentAndTargetValue(getParam("mix"));
    }

    void MixNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.size() < 2 ||
            !inputBuffers[0].isValid() || !inputBuffers[1].isValid())
            return;

        auto &inA = *inputBuffers[0].buffer; // "dry" signal
        auto &inB = *inputBuffers[1].buffer; // "wet" signal
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(inA.getNumChannels(), inB.getNumChannels(),
                                           out.getNumChannels());

        smoothedMix.setTargetValue(getParam("mix"));

        for (int s = 0; s < numSamples; ++s)
        {
            const float m = smoothedMix.getNextValue();
            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.setSample(ch, s,
                              inA.getSample(ch, s) * (1.0f - m) + inB.getSample(ch, s) * m);
            }
        }
    }

} // namespace rau
