#include "PanNode.h"
#include <cmath>

namespace rau
{

    PanNode::PanNode()
    {
        nodeType = "pan";
        addParam("pan", 0.0f); // center
        addParam("law", 1.0f); // equal power
        addParam("bypass", 0.0f);
    }

    void PanNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        smoothedPan.reset(sr, 0.02);
        smoothedPan.setCurrentAndTargetValue(getParam("pan"));
    }

    void PanNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;

        const int law = static_cast<int>(getParam("law"));
        smoothedPan.setTargetValue(juce::jlimit(-1.0f, 1.0f, getParam("pan")));

        // Handle mono->stereo or stereo->stereo
        const int inCh = in.getNumChannels();
        const int outCh = out.getNumChannels();

        if (outCh < 2)
        {
            // Mono output — just copy
            out.copyFrom(0, 0, in, 0, 0, numSamples);
            return;
        }

        for (int s = 0; s < numSamples; ++s)
        {
            const float pan = smoothedPan.getNextValue();

            // Convert pan (-1..1) to left/right gains
            float gainL, gainR;
            if (law == 0)
            {
                // Linear pan
                gainL = 0.5f * (1.0f - pan);
                gainR = 0.5f * (1.0f + pan);
            }
            else
            {
                // Equal power pan (constant power)
                float angle = (pan + 1.0f) * 0.25f * juce::MathConstants<float>::pi;
                gainL = std::cos(angle);
                gainR = std::sin(angle);
            }

            if (inCh == 1)
            {
                // Mono to stereo
                float mono = in.getSample(0, s);
                out.setSample(0, s, mono * gainL);
                out.setSample(1, s, mono * gainR);
            }
            else
            {
                // Stereo to stereo
                float left = in.getSample(0, s);
                float right = in.getSample(1, s);
                out.setSample(0, s, left * gainL);
                out.setSample(1, s, right * gainR);
            }
        }
    }

} // namespace rau
