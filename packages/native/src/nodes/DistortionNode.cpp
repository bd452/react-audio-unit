#include "DistortionNode.h"
#include <cmath>

namespace rau
{

    DistortionNode::DistortionNode()
    {
        nodeType = "distortion";
        addParam("distortionType", 0.0f); // soft
        addParam("drive", 1.0f);
        addParam("outputGain", 0.5f);
        addParam("mix", 1.0f);
        addParam("bypass", 0.0f);
    }

    void DistortionNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
    }

    void DistortionNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        const int distType = static_cast<int>(getParam("distortionType"));
        const float drive = std::max(1.0f, getParam("drive"));
        const float outputGain = getParam("outputGain");
        const float mix = juce::jlimit(0.0f, 1.0f, getParam("mix"));

        for (int ch = 0; ch < numChannels; ++ch)
        {
            auto *inPtr = in.getReadPointer(ch);
            auto *outPtr = out.getWritePointer(ch);

            for (int s = 0; s < numSamples; ++s)
            {
                float dry = inPtr[s];
                float x = dry * drive;
                float wet = 0.0f;

                switch (distType)
                {
                case 0: // Soft clip (cubic)
                {
                    if (x > 1.0f)
                        wet = 2.0f / 3.0f;
                    else if (x < -1.0f)
                        wet = -2.0f / 3.0f;
                    else
                        wet = x - (x * x * x) / 3.0f;
                    break;
                }
                case 1: // Hard clip
                    wet = juce::jlimit(-1.0f, 1.0f, x);
                    break;
                case 2: // Tanh
                    wet = std::tanh(x);
                    break;
                case 3: // Atan
                    wet = (2.0f / juce::MathConstants<float>::pi) * std::atan(x);
                    break;
                case 4: // Foldback
                {
                    // Fold the signal back when it exceeds ±1
                    wet = x;
                    while (wet > 1.0f || wet < -1.0f)
                    {
                        if (wet > 1.0f)
                            wet = 2.0f - wet;
                        else if (wet < -1.0f)
                            wet = -2.0f - wet;
                    }
                    break;
                }
                default:
                    wet = std::tanh(x);
                    break;
                }

                outPtr[s] = (dry * (1.0f - mix) + wet * mix) * outputGain;
            }
        }
    }

} // namespace rau
