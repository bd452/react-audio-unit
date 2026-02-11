#pragma once
#include "NodeBase.h"

namespace rau
{

    class FilterNode : public AudioNodeBase
    {
    public:
        FilterNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        void updateCoefficients();

        // Per-channel biquad state
        struct BiquadState
        {
            float x1 = 0, x2 = 0; // input history
            float y1 = 0, y2 = 0; // output history
        };

        std::array<BiquadState, 2> state; // stereo

        // Biquad coefficients
        float b0 = 1, b1 = 0, b2 = 0;
        float a1 = 0, a2 = 0;

        // Track previous params to know when to recalculate
        float prevCutoff = -1;
        float prevResonance = -1;
        float prevFilterType = -1;
        float prevGainDb = 0;
    };

} // namespace rau
