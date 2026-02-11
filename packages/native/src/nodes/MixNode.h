#pragma once
#include "NodeBase.h"

namespace rau
{

    class MixNode : public AudioNodeBase
    {
    public:
        MixNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        juce::SmoothedValue<float> smoothedMix;
    };

} // namespace rau
