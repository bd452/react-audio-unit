#include "MergeNode.h"

namespace rau
{

    MergeNode::MergeNode()
    {
        nodeType = "merge";
        addParam("bypass", 0.0f);
    }

    void MergeNode::process(int numSamples)
    {
        if (!outputBuffer.isValid())
            return;

        auto &out = *outputBuffer.buffer;
        const int outChannels = out.getNumChannels();

        const bool hasInlet0 = !inputBuffers.empty() && inputBuffers[0].isValid();
        const bool hasInlet1 = inputBuffers.size() > 1 && inputBuffers[1].isValid();

        // Left channel (output ch 0) ← inlet 0, channel 0
        if (outChannels > 0)
        {
            if (hasInlet0)
            {
                out.copyFrom(0, 0, *inputBuffers[0].buffer, 0, 0, numSamples);
            }
            else
            {
                out.clear(0, 0, numSamples);
            }
        }

        // Right channel (output ch 1) ← inlet 1, channel 0
        // If inlet 1 is not connected, duplicate left channel.
        if (outChannels > 1)
        {
            if (hasInlet1)
            {
                out.copyFrom(1, 0, *inputBuffers[1].buffer, 0, 0, numSamples);
            }
            else if (hasInlet0)
            {
                out.copyFrom(1, 0, *inputBuffers[0].buffer, 0, 0, numSamples);
            }
            else
            {
                out.clear(1, 0, numSamples);
            }
        }
    }

} // namespace rau
