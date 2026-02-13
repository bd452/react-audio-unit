#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * LFONode — low-frequency oscillator for modulation.
     *
     * Shape (float enum):
     *   0 = sine, 1 = triangle, 2 = saw, 3 = square, 4 = random (S&H)
     *
     * Parameters:
     *   shape  - Waveform shape (0–4)
     *   rate   - Rate in Hz (default 1.0)
     *   depth  - Modulation depth (0–1, default 1.0)
     *   phase  - Phase offset in degrees (default 0)
     *   bypass - Bypass flag
     *
     * Output is a control signal (0–1 range, centered at 0.5).
     */
    class LFONode : public AudioNodeBase
    {
    public:
        LFONode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        double lfoPhase = 0.0;
        float randomValue = 0.0f;
        float prevPhaseWrap = 0.0f;

        // Deterministic PRNG state (xorshift32) — avoids calling rand()
        // which is not thread-safe and may lock on the audio thread.
        // Each instance gets a unique seed from a monotonic counter so
        // multiple LFOs with shape=random produce different sequences.
        static inline std::atomic<uint32_t> seedCounter{0x12345678u};
        uint32_t prngState = seedCounter.fetch_add(0x9E3779B9u, std::memory_order_relaxed);
        float nextRandom()
        {
            prngState ^= prngState << 13;
            prngState ^= prngState >> 17;
            prngState ^= prngState << 5;
            return static_cast<float>(prngState) / static_cast<float>(0xFFFFFFFFu);
        }
    };

} // namespace rau
