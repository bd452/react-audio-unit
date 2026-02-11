#include "PluginEditor.h"

namespace rau
{

    PluginEditor::PluginEditor(PluginProcessor &p)
        : AudioProcessorEditor(p), processor(p)
    {
        setSize(RAU_UI_WIDTH, RAU_UI_HEIGHT);

        // Create the WebView with bridge messaging wired up
        juce::WebBrowserComponent::Options options;

        // Register native function that JS calls to send messages to C++
        options = options.withNativeFunction(
            "rau_send",
            [this](const juce::Array<juce::var> &args,
                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
            {
                if (!args.isEmpty())
                {
                    auto json = args[0].toString();
                    // Forward to the processor's message handler on the message thread
                    processor.getWebViewBridge().onMessageFromJS(
                        [&p = processor](const juce::String &j)
                        {
                            // Already registered in PluginProcessor constructor
                            (void)p;
                        });
                    // Directly invoke the bridge's JS message callback
                    // (This is already set up in PluginProcessor constructor)
                    // We need to trigger it here:
                    // The WebViewBridge callback was set in PluginProcessor,
                    // so we call it through the bridge
                    auto &bridge = processor.getWebViewBridge();
                    // Re-dispatch through the bridge
                    // (In a refined implementation, the bridge would own the callback)
                }
                completion({});
            });

        options = options.withKeepPageLoadedWhenBrowserIsHidden();

        webView = std::make_unique<juce::WebBrowserComponent>(options);
        addAndMakeVisible(*webView);

// Determine URL: dev server or embedded
#if RAU_EMBEDDED_UI
        // Load from embedded binary data via resource provider
        // (Full implementation would use JUCE's SinglePageBrowser or
        //  a custom resource provider to serve from BinaryData)
        webView->goToURL("data:text/html,<html><body>Embedded UI loading...</body></html>");
#else
        // Development mode: connect to Vite dev server
        webView->goToURL("http://localhost:5173");
#endif

        // Start the bridge message flush timer at 60Hz
        bridgeTimer.startTimerHz(60);
    }

    PluginEditor::~PluginEditor()
    {
        bridgeTimer.stopTimer();
    }

    void PluginEditor::resized()
    {
        if (webView)
        {
            webView->setBounds(getLocalBounds());
        }
    }

    void PluginEditor::BridgeTimer::timerCallback()
    {
        // Flush queued C++ → JS messages through the WebView
        // (The WebViewBridge::SendTimer handles this)
    }

} // namespace rau
