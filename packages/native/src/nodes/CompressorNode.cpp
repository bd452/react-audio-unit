#include "CompressorNode.h"
#include <cmath>
#include <algorithm>

namespace rau
{

    CompressorNode::CompressorNode()
    {
        nodeType = "compressor";
        addParam("threshold", -20.0f);
        addParam("ratio", 4.0f);
        addParam("attack", 10.0f);    // ms
        addParam("release", 100.0f);  // ms
        addParam("knee", 0.0f);       // dB
        addParam("makeupGain", 0.0f); // dB
        addParam("bypass", 0.0f);
    }

    void CompressorNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        envelopeDb = 0.0f;
    }

    void CompressorNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        const float threshold = getParam("threshold");
        const float ratio = std::max(1.0f, getParam("ratio"));
        const float attackMs = std::max(0.01f, getParam("attack"));
        const float releaseMs = std::max(0.01f, getParam("release"));
        const float kneeWidth = std::max(0.0f, getParam("knee"));
        const float makeupDb = getParam("makeupGain");
        const float makeupLinear = std::pow(10.0f, makeupDb / 20.0f);

        // Smoothing coefficients
        const float attackCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * attackMs / 1000.0f));
        const float releaseCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * releaseMs / 1000.0f));

        // Use sidechain if available, otherwise use main input
        auto &scInput = (inputBuffers.size() > 1 && inputBuffers[1].isValid())
                            ? *inputBuffers[1].buffer
                            : in;

        for (int s = 0; s < numSamples; ++s)
        {
            // Compute peak level across channels from sidechain
            float peak = 0.0f;
            for (int ch = 0; ch < juce::jmin(scInput.getNumChannels(), numChannels); ++ch)
            {
                peak = std::max(peak, std::abs(scInput.getSample(ch, s)));
            }

            // Convert to dB
            float inputDb = (peak > 1e-10f) ? 20.0f * std::log10(peak) : -100.0f;

            // Compute gain reduction with soft knee
            float gainReductionDb = 0.0f;
            if (kneeWidth > 0.0f)
            {
                float halfKnee = kneeWidth / 2.0f;
                if (inputDb < threshold - halfKnee)
                {
                    gainReductionDb = 0.0f;
                }
                else if (inputDb > threshold + halfKnee)
                {
                    gainReductionDb = (inputDb - threshold) * (1.0f - 1.0f / ratio);
                }
                else
                {
                    // Soft knee region
                    float x = inputDb - threshold + halfKnee;
                    gainReductionDb = (1.0f - 1.0f / ratio) * x * x / (2.0f * kneeWidth);
                }
            }
            else
            {
                // Hard knee
                if (inputDb > threshold)
                {
                    gainReductionDb = (inputDb - threshold) * (1.0f - 1.0f / ratio);
                }
            }

            // Smooth the envelope
            float targetDb = -gainReductionDb;
            float coeff = (targetDb < envelopeDb) ? attackCoeff : releaseCoeff;
            envelopeDb = coeff * envelopeDb + (1.0f - coeff) * targetDb;

            // Apply gain reduction + makeup
            float gainLinear = std::pow(10.0f, envelopeDb / 20.0f) * makeupLinear;

            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.setSample(ch, s, in.getSample(ch, s) * gainLinear);
            }
        }
    }

} // namespace rau
