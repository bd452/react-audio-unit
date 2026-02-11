#include "EnvelopeNode.h"
#include <cmath>
#include <algorithm>

namespace rau
{

    EnvelopeNode::EnvelopeNode()
    {
        nodeType = "envelope";
        addParam("attack", 10.0f); // ms
        addParam("decay", 100.0f); // ms
        addParam("sustain", 0.7f);
        addParam("release", 200.0f); // ms
        addParam("gate", 0.0f);
        addParam("bypass", 0.0f);
    }

    void EnvelopeNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        stage = Stage::Idle;
        envelope = 0.0f;
        wasGateOn = false;
    }

    void EnvelopeNode::process(int numSamples)
    {
        if (!outputBuffer.isValid())
            return;

        auto &out = *outputBuffer.buffer;
        const int numChannels = out.getNumChannels();

        const float attackMs = std::max(0.1f, getParam("attack"));
        const float decayMs = std::max(0.1f, getParam("decay"));
        const float sustainLevel = juce::jlimit(0.0f, 1.0f, getParam("sustain"));
        const float releaseMs = std::max(0.1f, getParam("release"));

        // Time constants (exponential approach)
        const float sr = static_cast<float>(sampleRate);
        const float attackRate = 1.0f / (attackMs * 0.001f * sr);
        const float decayRate = 1.0f / (decayMs * 0.001f * sr);
        const float releaseRate = 1.0f / (releaseMs * 0.001f * sr);

        for (int s = 0; s < numSamples; ++s)
        {
            // Read gate from parameter or from input signal
            float gateValue = getParam("gate");
            if (!inputBuffers.empty() && inputBuffers[0].isValid())
            {
                gateValue = inputBuffers[0].buffer->getSample(0, s);
            }
            bool gateOn = gateValue > 0.5f;

            // Gate transitions
            if (gateOn && !wasGateOn)
            {
                // Note on — start attack
                stage = Stage::Attack;
            }
            else if (!gateOn && wasGateOn)
            {
                // Note off — start release
                stage = Stage::Release;
            }
            wasGateOn = gateOn;

            // Process current stage
            switch (stage)
            {
            case Stage::Idle:
                envelope = 0.0f;
                break;
            case Stage::Attack:
                envelope += attackRate;
                if (envelope >= 1.0f)
                {
                    envelope = 1.0f;
                    stage = Stage::Decay;
                }
                break;
            case Stage::Decay:
                envelope -= (envelope - sustainLevel) * decayRate;
                if (std::abs(envelope - sustainLevel) < 0.001f)
                {
                    envelope = sustainLevel;
                    stage = Stage::Sustain;
                }
                break;
            case Stage::Sustain:
                envelope = sustainLevel;
                break;
            case Stage::Release:
                envelope -= envelope * releaseRate;
                if (envelope < 0.001f)
                {
                    envelope = 0.0f;
                    stage = Stage::Idle;
                }
                break;
            }

            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.setSample(ch, s, envelope);
            }
        }
    }

} // namespace rau
