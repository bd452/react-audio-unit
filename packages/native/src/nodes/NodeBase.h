#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_dsp/juce_dsp.h>
#include <atomic>
#include <string>
#include <unordered_map>
#include <vector>

namespace rau
{

    /**
     * BufferRef — lightweight reference to a buffer in the pool.
     * Used to pass audio between nodes without copying.
     */
    struct BufferRef
    {
        juce::AudioBuffer<float> *buffer = nullptr;
        int index = -1;

        bool isValid() const { return buffer != nullptr; }
    };

    /**
     * AtomicFloat — a move-safe wrapper around std::atomic<float>.
     *
     * std::atomic is neither copyable nor movable, which is a problem
     * for containers like std::unordered_map that may need to rehash.
     * This wrapper provides move semantics by loading/storing the value
     * during moves. The move is NOT atomic with respect to concurrent
     * readers, but moves only happen during node construction on the
     * message thread (before the audio thread sees the node).
     */
    struct AtomicFloat
    {
        std::atomic<float> value;

        AtomicFloat(float v = 0.0f) : value(v) {}
        AtomicFloat(const AtomicFloat &other) : value(other.value.load(std::memory_order_relaxed)) {}
        AtomicFloat(AtomicFloat &&other) noexcept : value(other.value.load(std::memory_order_relaxed)) {}
        AtomicFloat &operator=(const AtomicFloat &other)
        {
            value.store(other.value.load(std::memory_order_relaxed), std::memory_order_relaxed);
            return *this;
        }
        AtomicFloat &operator=(AtomicFloat &&other) noexcept
        {
            value.store(other.value.load(std::memory_order_relaxed), std::memory_order_relaxed);
            return *this;
        }

        void store(float v, std::memory_order order = std::memory_order_relaxed) { value.store(v, order); }
        float load(std::memory_order order = std::memory_order_relaxed) const { return value.load(order); }
    };

    /**
     * AudioNodeBase — base class for all DSP nodes.
     *
     * Subclasses implement prepare() and process(). Parameters are
     * stored as atomics and updated from the message thread; the
     * audio thread reads them lock-free.
     */
    class AudioNodeBase
    {
    public:
        virtual ~AudioNodeBase() = default;

        // Identity
        std::string nodeId;
        std::string nodeType;

        // --- Lifecycle -----------------------------------------------------------

        virtual void prepare(double sr, int blockSize)
        {
            sampleRate = sr;
            maxBlockSize = blockSize;
        }

        /**
         * Process one block of audio. Read from inputBuffers, write to outputBuffer.
         * Called on the audio thread — must be real-time safe.
         */
        virtual void process(int numSamples) = 0;

        /**
         * Bypass processing — copy first input to output.
         */
        virtual void processBypass(int numSamples)
        {
            if (!inputBuffers.empty() && inputBuffers[0].isValid() && outputBuffer.isValid())
            {
                for (int ch = 0; ch < outputBuffer.buffer->getNumChannels(); ++ch)
                {
                    if (ch < inputBuffers[0].buffer->getNumChannels())
                    {
                        outputBuffer.buffer->copyFrom(ch, 0, *inputBuffers[0].buffer, ch, 0, numSamples);
                    }
                    else
                    {
                        outputBuffer.buffer->clear(ch, 0, numSamples);
                    }
                }
            }
        }

        // --- Parameters ----------------------------------------------------------

        void setParam(const std::string &name, float value)
        {
            auto it = params.find(name);
            if (it != params.end())
            {
                it->second.store(value, std::memory_order_relaxed);
            }
        }

        float getParam(const std::string &name) const
        {
            auto it = params.find(name);
            if (it != params.end())
            {
                return it->second.load(std::memory_order_relaxed);
            }
            return 0.0f;
        }

        bool isBypassed() const
        {
            auto it = params.find("bypass");
            if (it != params.end())
            {
                return it->second.load(std::memory_order_relaxed) > 0.5f;
            }
            return false;
        }

        // --- Connections ---------------------------------------------------------

        std::vector<BufferRef> inputBuffers;
        BufferRef outputBuffer;

    protected:
        double sampleRate = 44100.0;
        int maxBlockSize = 512;

        void addParam(const std::string &name, float defaultValue = 0.0f)
        {
            params.emplace(name, defaultValue);
        }

    private:
        std::unordered_map<std::string, AtomicFloat> params;
    };

} // namespace rau
