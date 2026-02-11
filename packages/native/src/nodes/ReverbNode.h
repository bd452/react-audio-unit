#pragma once
#include "NodeBase.h"
#include <array>

namespace rau
{

    /**
     * ReverbNode — algorithmic reverb based on Schroeder/Moorer design.
     *
     * Parameters:
     *   roomSize  - Room size (0–1, default 0.5)
     *   damping   - High-frequency damping (0–1, default 0.5)
     *   preDelay  - Pre-delay in ms (default 0)
     *   mix       - Dry/wet mix (0–1, default 0.3)
     *   bypass    - Bypass flag
     */
    class ReverbNode : public AudioNodeBase
    {
    public:
        ReverbNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        juce::Reverb reverb;
        juce::Reverb::Parameters reverbParams;
    };

} // namespace rau
