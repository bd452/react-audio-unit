#include "SplitNode.h"

namespace rau
{

    SplitNode::SplitNode()
    {
        nodeType = "split";
        addParam("bypass", 0.0f);
    }

    void SplitNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int inChannels = in.getNumChannels();
        const int outChannels = out.getNumChannels();

        // Copy left channel (input ch 0) → output ch 0
        if (outChannels > 0 && inChannels > 0)
        {
            out.copyFrom(0, 0, in, 0, 0, numSamples);
        }

        // Copy right channel (input ch 1) → output ch 1
        // If input is mono, duplicate left into right.
        if (outChannels > 1)
        {
            const int srcCh = (inChannels > 1) ? 1 : 0;
            out.copyFrom(1, 0, in, srcCh, 0, numSamples);
        }
    }

} // namespace rau
