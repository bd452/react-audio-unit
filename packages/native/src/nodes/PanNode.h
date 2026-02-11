#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * PanNode — stereo panner.
     *
     * Pan law (float enum):
     *   0 = linear, 1 = equal power
     *
     * Parameters:
     *   pan    - Pan position (-1 = left, 0 = center, 1 = right)
     *   law    - Pan law (0 = linear, 1 = equal power)
     *   bypass - Bypass flag
     */
    class PanNode : public AudioNodeBase
    {
    public:
        PanNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        juce::SmoothedValue<float> smoothedPan;
    };

} // namespace rau
