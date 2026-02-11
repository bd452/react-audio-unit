#pragma once
#include "NodeBase.h"
#include <array>
#include <vector>

namespace rau
{

    /**
     * ReverbNode — algorithmic reverb based on Schroeder/Moorer design.
     *
     * Parameters:
     *   roomSize  - Room size (0–1, default 0.5)
     *   damping   - High-frequency damping (0–1, default 0.5)
     *   preDelay  - Pre-delay in ms (0–250, default 0)
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

        // Pre-delay line
        static constexpr float MAX_PRE_DELAY_MS = 250.0f;
        std::vector<std::vector<float>> preDelayBuffer; // [channel][sample]
        int preDelayBufferSize = 0;
        int preDelayWritePos = 0;
        juce::SmoothedValue<float> smoothedPreDelay;
    };

} // namespace rau
