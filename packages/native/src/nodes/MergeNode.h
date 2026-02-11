#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * MergeNode — combines two mono inputs into a stereo output.
     *
     * Inlet 0 → left channel, inlet 1 → right channel.
     * If only inlet 0 is connected the signal is copied to both channels
     * (mono → stereo).
     */
    class MergeNode : public AudioNodeBase
    {
    public:
        MergeNode();
        void process(int numSamples) override;
    };

} // namespace rau
