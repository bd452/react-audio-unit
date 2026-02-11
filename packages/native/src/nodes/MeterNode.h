#pragma once
#include "NodeBase.h"
#include <array>

namespace rau
{

    /**
     * MeterNode — computes RMS and peak levels per channel.
     *
     * Passes audio through unchanged. Stores computed levels that
     * can be read by the processor and sent to JS via the bridge.
     *
     * Parameters:
     *   meterType   - 0 = peak, 1 = rms, 2 = both (default 2)
     *   bypass      - Bypass flag
     */
    class MeterNode : public AudioNodeBase
    {
    public:
        MeterNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

        /** Read the latest meter data. Thread-safe (atomic reads). */
        float getPeak(int channel) const;
        float getRms(int channel) const;

    private:
        static constexpr int MAX_CHANNELS = 2;
        std::array<std::atomic<float>, MAX_CHANNELS> peakLevel;
        std::array<std::atomic<float>, MAX_CHANNELS> rmsLevel;
        std::array<float, MAX_CHANNELS> rmsAccumulator{};
        int blockCount = 0;
    };

} // namespace rau
