#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

namespace rau
{

    /**
     * PluginEditor — hosts the WebView that renders the React UI.
     *
     * In production, the WebView loads the embedded HTML/JS/CSS bundle.
     * In development, it connects to a Vite dev server for hot reloading.
     */
    class PluginEditor : public juce::AudioProcessorEditor
    {
    public:
        explicit PluginEditor(PluginProcessor &);
        ~PluginEditor() override;

        void resized() override;

    private:
        PluginProcessor &processor;
        std::unique_ptr<juce::WebBrowserComponent> webView;

        // Timer for flushing C++ → JS messages
        class BridgeTimer : public juce::Timer
        {
        public:
            BridgeTimer(PluginEditor &e) : editor(e) {}
            void timerCallback() override;
            PluginEditor &editor;
        };
        BridgeTimer bridgeTimer{*this};

        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginEditor)
    };

} // namespace rau
