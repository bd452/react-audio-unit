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

        // Enable JUCE's JS backend integration (`window.__JUCE__.backend`).
        options = options.withNativeIntegrationEnabled();

        // Register an event listener for JS → C++ bridge messages.
        // The JS bridge sends: window.__JUCE__.backend.emitEvent("rau_js_message", payload)
        options = options.withEventListener(
            "rau_js_message",
            [this](const juce::var &payload)
            {
                if (!jsMessageCallback)
                    return;

                if (payload.isString())
                {
                    jsMessageCallback(payload.toString());
                    return;
                }

                // Fallback: if JS sent an object, normalize it to JSON text.
                jsMessageCallback(juce::JSON::toString(payload));
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
