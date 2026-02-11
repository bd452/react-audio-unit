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
                // Dispatch as a CustomEvent that the JS bridge listens for.
                // The JS side's NativeBridge.connect() registers a listener
                // for 'rau_native_message' events.
                auto js = juce::String(
                              "window.dispatchEvent("
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

    juce::WebBrowserComponent::Options WebViewBridge::createWebViewOptions()
    {
        juce::WebBrowserComponent::Options options;

        // Register native function for JS → C++ messages.
        // The JS bridge calls: window.__JUCE__.backend.emitEvent("rau_js_message", jsonStr)
        // JUCE translates that into a call to this native function.
        options = options.withNativeFunction(
            "rau_js_message",
            [this](const juce::Array<juce::var> &args,
                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
            {
                if (args.size() > 0 && jsMessageCallback)
                {
                    jsMessageCallback(args[0].toString());
                }
                completion({});
            });

        options = options.withKeepPageLoadedWhenBrowserIsHidden();

        return options;
    }

    void WebViewBridge::setWebView(juce::WebBrowserComponent *wv)
    {
        webView = wv;

        if (webView != nullptr)
        {
            // Start the send timer (60fps message flush rate)
            sendTimer->startTimerHz(60);
        }
        else
        {
            sendTimer->stopTimer();
        }
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
