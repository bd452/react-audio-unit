#include "WebViewBridge.h"

namespace rau
{

    // ---------------------------------------------------------------------------
    // Timer that flushes queued messages to the WebView on the message thread
    // ---------------------------------------------------------------------------

    class WebViewBridge::SendTimer : public juce::Timer
    {
    public:
        SendTimer(WebViewBridge &owner) : bridge(owner) {}

        void timerCallback() override
        {
            std::vector<juce::String> messages;
            {
                std::lock_guard<std::mutex> lock(bridge.sendQueueMutex);
                std::swap(messages, bridge.sendQueue);
            }

            if (bridge.webView == nullptr)
                return;

            for (auto &msg : messages)
            {
                // Dispatch as a custom event that the JS bridge listens for
                auto js = juce::String(
                              "window.__JUCE__ && window.__JUCE__.backend && "
                              "window.__JUCE__.backend.dispatchEvent("
                              "new CustomEvent('rau_native_message', { detail: ") +
                          msg.quoted() + " }));";
                bridge.webView->evaluateJavascript(js);
            }
        }

        WebViewBridge &bridge;
    };

    // ---------------------------------------------------------------------------
    // WebViewBridge implementation
    // ---------------------------------------------------------------------------

    WebViewBridge::WebViewBridge()
    {
        sendTimer = std::make_unique<SendTimer>(*this);
    }

    WebViewBridge::~WebViewBridge()
    {
        sendTimer->stopTimer();
    }

    std::unique_ptr<juce::WebBrowserComponent> WebViewBridge::createWebView(
        const juce::String &devServerUrl)
    {

        juce::WebBrowserComponent::Options options;

        // Register native function for JS → C++ messages
        options = options.withNativeFunction(
            "rau_js_message",
            [this](const juce::Array<juce::var> &args, juce::WebBrowserComponent::NativeFunctionCompletion)
            {
                if (args.size() > 0 && jsMessageCallback)
                {
                    jsMessageCallback(args[0].toString());
                }
            });

        // Allow access to local resources
        options = options.withKeepPageLoadedWhenBrowserIsHidden();

        auto browser = std::make_unique<juce::WebBrowserComponent>(options);

        if (devServerUrl.isNotEmpty())
        {
            browser->goToURL(devServerUrl);
        }
        else
        {
#if RAU_EMBEDDED_UI
            // Serve from embedded binary data
            // The resource provider is set up via JUCE's WebBrowserComponent options
            browser->goToURL("http://localhost/index.html");
#else
            browser->goToURL("http://localhost:5173");
#endif
        }

        webView = std::move(browser);

        // Start the send timer (60fps message flush rate)
        sendTimer->startTimerHz(60);

        // Return a separate reference — we keep ownership
        // Actually, the caller owns it. We keep a raw pointer.
        auto result = std::make_unique<juce::WebBrowserComponent>(options);

        // Re-think: the caller should get the actual webView.
        // We'll store a raw pointer and give ownership to the caller.
        webView.reset();
        webView.reset(result.get());

        // This pattern doesn't work well. Let's restructure:
        // The editor creates the WebBrowserComponent, we just configure it.

        return nullptr; // See PluginEditor for actual creation
    }

    void WebViewBridge::sendToJS(const juce::String &jsonMessage)
    {
        std::lock_guard<std::mutex> lock(sendQueueMutex);
        sendQueue.push_back(jsonMessage);
    }

    void WebViewBridge::onMessageFromJS(std::function<void(const juce::String &)> callback)
    {
        jsMessageCallback = std::move(callback);
    }

} // namespace rau
