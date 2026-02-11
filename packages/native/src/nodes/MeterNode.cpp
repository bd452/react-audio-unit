#include "MeterNode.h"
#include <cmath>

namespace rau
{

    MeterNode::MeterNode()
    {
        nodeType = "meter";
        addParam("meterType", 2.0f); // both
        addParam("bypass", 0.0f);

        for (auto &p : peakLevel)
            p.store(0.0f, std::memory_order_relaxed);
        for (auto &r : rmsLevel)
            r.store(0.0f, std::memory_order_relaxed);
    }

    void MeterNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        for (auto &p : peakLevel)
            p.store(0.0f, std::memory_order_relaxed);
        for (auto &r : rmsLevel)
            r.store(0.0f, std::memory_order_relaxed);
        rmsAccumulator.fill(0.0f);
        blockCount = 0;
    }

    void MeterNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels(),
                                           static_cast<int>(MAX_CHANNELS));

        for (int ch = 0; ch < numChannels; ++ch)
        {
            // Pass through
            out.copyFrom(ch, 0, in, ch, 0, numSamples);

            // Compute peak
            float peak = 0.0f;
            float sumSquares = 0.0f;
            auto *data = in.getReadPointer(ch);
            for (int s = 0; s < numSamples; ++s)
            {
                float absVal = std::abs(data[s]);
                if (absVal > peak)
                    peak = absVal;
                sumSquares += data[s] * data[s];
            }

            // Update peak with decay
            float prevPeak = peakLevel[static_cast<size_t>(ch)].load(std::memory_order_relaxed);
            float newPeak = std::max(peak, prevPeak * 0.95f); // ~50ms decay at 44.1k/512
            peakLevel[static_cast<size_t>(ch)].store(newPeak, std::memory_order_relaxed);

            // Update RMS
            float rms = std::sqrt(sumSquares / static_cast<float>(numSamples));
            rmsLevel[static_cast<size_t>(ch)].store(rms, std::memory_order_relaxed);
        }
    }

    float MeterNode::getPeak(int channel) const
    {
        if (channel >= 0 && channel < MAX_CHANNELS)
            return peakLevel[static_cast<size_t>(channel)].load(std::memory_order_relaxed);
        return 0.0f;
    }

    float MeterNode::getRms(int channel) const
    {
        if (channel >= 0 && channel < MAX_CHANNELS)
            return rmsLevel[static_cast<size_t>(channel)].load(std::memory_order_relaxed);
        return 0.0f;
    }

} // namespace rau
