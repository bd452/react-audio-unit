#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * SplitNode — stereo passthrough that semantically marks a split point.
     *
     * Takes a stereo input on inlet 0 and copies left channel to output
     * channel 0, right channel to output channel 1. Downstream nodes can
     * tap individual channels via inlet routing.
     */
    class SplitNode : public AudioNodeBase
    {
    public:
        SplitNode();
        void process(int numSamples) override;
    };

} // namespace rau
