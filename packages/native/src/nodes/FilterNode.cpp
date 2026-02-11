#include "FilterNode.h"
#include <cmath>

namespace rau
{

    namespace
    {
        // Filter type enum matching JS side
        enum FilterTypeId
        {
            LowPass = 0,
            HighPass,
            BandPass,
            Notch,
            AllPass,
            LowShelf,
            HighShelf,
            Peaking
        };

    }

    FilterNode::FilterNode()
    {
        nodeType = "filter";
        addParam("filterType", 0.0f);  // enum as float
        addParam("cutoff", 1000.0f);   // Hz
        addParam("resonance", 0.707f); // Q
        addParam("gainDb", 0.0f);      // for shelf/peaking
        addParam("bypass", 0.0f);
    }

    void FilterNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        for (auto &s : state)
        {
            s = {};
        }
        prevCutoff = -1; // force coefficient recalculation
    }

    void FilterNode::updateCoefficients()
    {
        const float cutoff = juce::jlimit(20.0f, static_cast<float>(sampleRate * 0.499), getParam("cutoff"));
        const float Q = juce::jmax(0.1f, getParam("resonance"));
        const float gainDb = getParam("gainDb");
        const float typeVal = getParam("filterType");

        // Map string-based filterType to numeric ID
        // In the bridge, we convert "lowpass"->0, "highpass"->1, etc.
        const int typeId = static_cast<int>(typeVal);

        const float w0 = 2.0f * juce::MathConstants<float>::pi * cutoff / static_cast<float>(sampleRate);
        const float cosw0 = std::cos(w0);
        const float sinw0 = std::sin(w0);
        const float alpha = sinw0 / (2.0f * Q);
        const float A = std::pow(10.0f, gainDb / 40.0f); // for shelf/peaking

        float _b0 = 1, _b1 = 0, _b2 = 0, _a0 = 1, _a1 = 0, _a2 = 0;

        switch (typeId)
        {
        case LowPass:
            _b0 = (1.0f - cosw0) / 2.0f;
            _b1 = 1.0f - cosw0;
            _b2 = (1.0f - cosw0) / 2.0f;
            _a0 = 1.0f + alpha;
            _a1 = -2.0f * cosw0;
            _a2 = 1.0f - alpha;
            break;
        case HighPass:
            _b0 = (1.0f + cosw0) / 2.0f;
            _b1 = -(1.0f + cosw0);
            _b2 = (1.0f + cosw0) / 2.0f;
            _a0 = 1.0f + alpha;
            _a1 = -2.0f * cosw0;
            _a2 = 1.0f - alpha;
            break;
        case BandPass:
            _b0 = alpha;
            _b1 = 0;
            _b2 = -alpha;
            _a0 = 1.0f + alpha;
            _a1 = -2.0f * cosw0;
            _a2 = 1.0f - alpha;
            break;
        case Notch:
            _b0 = 1;
            _b1 = -2.0f * cosw0;
            _b2 = 1;
            _a0 = 1.0f + alpha;
            _a1 = -2.0f * cosw0;
            _a2 = 1.0f - alpha;
            break;
        case AllPass:
            _b0 = 1.0f - alpha;
            _b1 = -2.0f * cosw0;
            _b2 = 1.0f + alpha;
            _a0 = 1.0f + alpha;
            _a1 = -2.0f * cosw0;
            _a2 = 1.0f - alpha;
            break;
        case LowShelf:
        {
            float sqrtA = std::sqrt(A);
            _b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha);
            _b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
            _b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha);
            _a0 = (A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha;
            _a1 = -2 * ((A - 1) + (A + 1) * cosw0);
            _a2 = (A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha;
            break;
        }
        case HighShelf:
        {
            float sqrtA = std::sqrt(A);
            _b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha);
            _b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
            _b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha);
            _a0 = (A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha;
            _a1 = 2 * ((A - 1) - (A + 1) * cosw0);
            _a2 = (A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha;
            break;
        }
        case Peaking:
            _b0 = 1.0f + alpha * A;
            _b1 = -2.0f * cosw0;
            _b2 = 1.0f - alpha * A;
            _a0 = 1.0f + alpha / A;
            _a1 = -2.0f * cosw0;
            _a2 = 1.0f - alpha / A;
            break;
        }

        // Normalize
        b0 = _b0 / _a0;
        b1 = _b1 / _a0;
        b2 = _b2 / _a0;
        a1 = _a1 / _a0;
        a2 = _a2 / _a0;
    }

    void FilterNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        // Recalculate coefficients if params changed
        float cutoff = getParam("cutoff");
        float resonance = getParam("resonance");
        float filterType = getParam("filterType");
        float gainDb = getParam("gainDb");

        if (std::abs(cutoff - prevCutoff) > 1e-6f ||
            std::abs(resonance - prevResonance) > 1e-6f ||
            std::abs(filterType - prevFilterType) > 0.5f ||
            std::abs(gainDb - prevGainDb) > 1e-6f)
        {
            updateCoefficients();
            prevCutoff = cutoff;
            prevResonance = resonance;
            prevFilterType = filterType;
            prevGainDb = gainDb;
        }

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        for (size_t ch = 0; ch < static_cast<size_t>(numChannels) && ch < 2; ++ch)
        {
            auto &st = state[ch];
            const float *inData = in.getReadPointer(static_cast<int>(ch));
            float *outData = out.getWritePointer(static_cast<int>(ch));

            for (int s = 0; s < numSamples; ++s)
            {
                const float x = inData[s];
                const float y = b0 * x + b1 * st.x1 + b2 * st.x2 - a1 * st.y1 - a2 * st.y2;

                st.x2 = st.x1;
                st.x1 = x;
                st.y2 = st.y1;
                st.y1 = y;

                outData[s] = y;
            }
        }
    }

} // namespace rau
