#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <unordered_map>
#include <string>
#include <functional>

namespace rau
{

    /**
     * ParameterStore — manages DAW-automatable parameters.
     *
     * Each parameter registered from JS gets a corresponding
     * juce::AudioParameterFloat added to the processor. Changes
     * from the DAW (automation) are forwarded to JS; changes from
     * JS (UI) are forwarded to the DAW.
     */
    class ParameterStore : public juce::AudioProcessorValueTreeState::Listener
    {
    public:
        explicit ParameterStore(juce::AudioProcessor &processor);
        ~ParameterStore() override;

        /**
         * Register a parameter. Must be called before the processor
         * is fully initialized (i.e., during construction or via
         * deferred registration with a parameter layout).
         *
         * In practice, we pre-allocate a fixed number of generic
         * parameter slots and map JS parameter IDs to them dynamically.
         */
        void registerParameter(const std::string &id, float min, float max,
                               float defaultValue, const std::string &label);

        void setParameterValue(const std::string &id, float value);
        float getParameterValue(const std::string &id) const;

        /**
         * Set a callback invoked when the DAW changes a parameter
         * (automation, MIDI learn, etc.).
         */
        void onParameterChanged(std::function<void(const std::string &id, float value)> callback);

        /**
         * Create the APVTS parameter layout. Call this during processor construction.
         * Pre-allocates generic parameter slots.
         */
        static juce::AudioProcessorValueTreeState::ParameterLayout createLayout(int maxParams = 128);

        /**
         * Bind the APVTS to this store after processor construction.
         */
        void bindAPVTS(juce::AudioProcessorValueTreeState &apvts);

        /** Get the current state as a JSON string. */
        std::string getStateAsJson() const;

        /** Restore state from a JSON string. */
        void restoreStateFromJson(const std::string &json);

    private:
        void parameterChanged(const juce::String &parameterID, float newValue) override;

        juce::AudioProcessorValueTreeState *apvts = nullptr;

        // Map from JS param ID → APVTS slot ID
        std::unordered_map<std::string, std::string> idToSlot;
        std::unordered_map<std::string, std::string> slotToId;
        int nextSlot = 0;

        // Range mapping: slot ID → {min, max}
        std::unordered_map<std::string, std::pair<float, float>> rangeMap;

        std::function<void(const std::string &, float)> changeCallback;
    };

} // namespace rau
