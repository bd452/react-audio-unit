#include "LFONode.h"
#include <cmath>

namespace rau
{

    LFONode::LFONode()
    {
        nodeType = "lfo";
        addParam("shape", 0.0f); // sine
        addParam("rate", 1.0f);  // Hz
        addParam("depth", 1.0f);
        addParam("phase", 0.0f); // degrees
        addParam("bypass", 0.0f);
    }

    void LFONode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        lfoPhase = 0.0;
        randomValue = 0.5f;
        prevPhaseWrap = 0.0f;
    }

    void LFONode::process(int numSamples)
    {
        if (!outputBuffer.isValid())
            return;

        auto &out = *outputBuffer.buffer;
        const int numChannels = out.getNumChannels();
        const int shape = static_cast<int>(getParam("shape"));
        const float rate = std::max(0.001f, getParam("rate"));
        const float depth = juce::jlimit(0.0f, 1.0f, getParam("depth"));
        const float phaseOffset = getParam("phase") / 360.0f;

        for (int s = 0; s < numSamples; ++s)
        {
            float p = static_cast<float>(std::fmod(lfoPhase + static_cast<double>(phaseOffset), 1.0));
            if (p < 0.0f)
                p += 1.0f;

            float value = 0.0f;
            switch (shape)
            {
            case 0: // Sine
                value = 0.5f + 0.5f * std::sin(p * juce::MathConstants<float>::twoPi);
                break;
            case 1: // Triangle
                value = (p < 0.5f) ? (p * 2.0f) : (2.0f - p * 2.0f);
                break;
            case 2: // Saw
                value = p;
                break;
            case 3: // Square
                value = (p < 0.5f) ? 1.0f : 0.0f;
                break;
            case 4: // Random (sample & hold)
            {
                // New random value at each cycle — uses deterministic PRNG
                // instead of rand() for thread safety on the audio thread.
                if (p < prevPhaseWrap)
                {
                    randomValue = nextRandom();
                }
                value = randomValue;
                break;
            }
            default:
                value = 0.5f + 0.5f * std::sin(p * juce::MathConstants<float>::twoPi);
                break;
            }

            prevPhaseWrap = p;

            // Apply depth: interpolate between 0.5 (no modulation) and value
            float output = 0.5f + (value - 0.5f) * depth;

            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.setSample(ch, s, output);
            }

            lfoPhase += static_cast<double>(rate) / sampleRate;
            if (lfoPhase >= 1.0)
                lfoPhase -= 1.0;
        }
    }

} // namespace rau
