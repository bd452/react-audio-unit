#pragma once
#include "NodeBase.h"

namespace rau
{

    class GainNode : public AudioNodeBase
    {
    public:
        GainNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        juce::SmoothedValue<float> smoothedGain;
    };

} // namespace rau
