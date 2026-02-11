#include "OscillatorNode.h"
#include <cmath>

namespace rau
{

    OscillatorNode::OscillatorNode()
    {
        nodeType = "oscillator";
        addParam("waveform", 0.0f); // sine
        addParam("frequency", 440.0f);
        addParam("detune", 0.0f); // cents
        addParam("gain", 1.0f);
        addParam("bypass", 0.0f);
    }

    void OscillatorNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        phase = 0.0;
        smoothedFreq.reset(sr, 0.005); // 5ms smoothing
        smoothedFreq.setCurrentAndTargetValue(getParam("frequency"));
    }

    void OscillatorNode::process(int numSamples)
    {
        if (!outputBuffer.isValid())
            return;

        auto &out = *outputBuffer.buffer;
        const int numChannels = out.getNumChannels();
        const int waveform = static_cast<int>(getParam("waveform"));
        const float detuneCents = getParam("detune");
        const float gain = getParam("gain");

        // Apply detune: frequency * 2^(cents/1200)
        float baseFreq = getParam("frequency");
        float detuneMultiplier = std::pow(2.0f, detuneCents / 1200.0f);
        smoothedFreq.setTargetValue(baseFreq * detuneMultiplier);

        for (int s = 0; s < numSamples; ++s)
        {
            float freq = smoothedFreq.getNextValue();
            float sample = 0.0f;

            switch (waveform)
            {
            case 0: // Sine
                sample = std::sin(static_cast<float>(phase * 2.0 * juce::MathConstants<double>::pi));
                break;
            case 1: // Saw (naive, anti-aliased via polyBLEP would be better)
                sample = static_cast<float>(2.0 * (phase - std::floor(phase + 0.5)));
                break;
            case 2: // Square
                sample = phase < 0.5 ? 1.0f : -1.0f;
                break;
            case 3: // Triangle
                sample = static_cast<float>(4.0 * std::abs(phase - 0.5) - 1.0);
                break;
            default:
                sample = std::sin(static_cast<float>(phase * 2.0 * juce::MathConstants<double>::pi));
                break;
            }

            sample *= gain;

            // Write same sample to all channels (mono generator)
            for (int ch = 0; ch < numChannels; ++ch)
            {
                out.setSample(ch, s, sample);
            }

            // Advance phase
            phase += static_cast<double>(freq) / sampleRate;
            if (phase >= 1.0)
                phase -= 1.0;
        }
    }

} // namespace rau
