#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "AudioGraph.h"
#include "ParameterStore.h"
#include "WebViewBridge.h"

namespace rau
{

    /**
     * PluginProcessor — the JUCE AudioProcessor for a React Audio Unit plugin.
     *
     * This is the entry point for the DAW. It:
     *   - Hosts the AudioGraph (DSP engine)
     *   - Manages parameters via ParameterStore
     *   - Owns the WebViewBridge for JS communication
     *   - Handles state save/recall
     */
    class PluginProcessor : public juce::AudioProcessor
    {
    public:
        PluginProcessor();
        ~PluginProcessor() override;

        // --- AudioProcessor overrides -------------------------------------------
        void prepareToPlay(double sampleRate, int samplesPerBlock) override;
        void releaseResources() override;
        void processBlock(juce::AudioBuffer<float> &, juce::MidiBuffer &) override;

        juce::AudioProcessorEditor *createEditor() override;
        bool hasEditor() const override { return true; }

        const juce::String getName() const override { return JucePlugin_Name; }

        bool acceptsMidi() const override
        {
#if JucePlugin_WantsMidiInput
            return true;
#else
            return false;
#endif
        }
        bool producesMidi() const override { return false; }
        double getTailLengthSeconds() const override { return 0.0; }

        int getNumPrograms() override { return 1; }
        int getCurrentProgram() override { return 0; }
        void setCurrentProgram(int) override {}
        const juce::String getProgramName(int) override { return {}; }
        void changeProgramName(int, const juce::String &) override {}

        void getStateInformation(juce::MemoryBlock &destData) override;
        void setStateInformation(const void *data, int sizeInBytes) override;

        // --- Public accessors ---------------------------------------------------
        AudioGraph &getAudioGraph() { return audioGraph; }
        ParameterStore &getParameterStore() { return paramStore; }
        WebViewBridge &getWebViewBridge() { return webViewBridge; }

    private:
        /** Parse and dispatch a JSON message from JS. */
        void handleJSMessage(const juce::String &json);

        AudioGraph audioGraph;
        ParameterStore paramStore;
        WebViewBridge webViewBridge;

        juce::AudioProcessorValueTreeState apvts;

        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginProcessor)
    };

} // namespace rau
