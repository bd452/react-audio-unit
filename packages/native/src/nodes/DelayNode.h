#pragma once
#include "NodeBase.h"

namespace rau
{

    class DelayNode : public AudioNodeBase
    {
    public:
        DelayNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        static constexpr float MAX_DELAY_MS = 5000.0f;

        std::vector<std::vector<float>> delayBuffer; // [channel][sample]
        int writePos = 0;
        int delayBufferSize = 0;
        juce::SmoothedValue<float> smoothedTime;
    };

} // namespace rau
