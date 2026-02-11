#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * DistortionNode — waveshaper with multiple curve types.
     *
     * Distortion types (float enum):
     *   0 = soft clip, 1 = hard clip, 2 = tanh, 3 = atan, 4 = foldback
     *
     * Parameters:
     *   distortionType - Curve type (0–4)
     *   drive          - Drive amount (1–100, default 1)
     *   outputGain     - Output level (0–1, default 0.5)
     *   mix            - Dry/wet (0–1, default 1)
     *   bypass         - Bypass flag
     */
    class DistortionNode : public AudioNodeBase
    {
    public:
        DistortionNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;
    };

} // namespace rau
