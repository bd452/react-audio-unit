#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include <functional>
#include <string>
#include <queue>
#include <mutex>

namespace rau
{

    /**
     * WebViewBridge — manages bidirectional communication between
     * the JUCE C++ plugin and the React UI running in a WebView.
     *
     * JS → C++: via JUCE WebBrowserComponent's native function mechanism
     * C++ → JS: via evaluateJavascript() / emitEventIfBrowserIsVisible()
     */
    class WebViewBridge
    {
    public:
        WebViewBridge();
        ~WebViewBridge();

        /**
         * Create the WebBrowserComponent with the bridge wired up.
         * Returns the component to be added to the editor.
         *
         * @param devServerUrl  If non-empty, load from dev server. Otherwise, serve embedded resources.
         */
        std::unique_ptr<juce::WebBrowserComponent> createWebView(
            const juce::String &devServerUrl = {});

        /**
         * Send a message to the JS side.
         * Thread-safe — can be called from any thread. Messages are
         * dispatched to the WebView on the message thread.
         */
        void sendToJS(const juce::String &jsonMessage);

        /**
         * Register a callback for messages received from JS.
         */
        void onMessageFromJS(std::function<void(const juce::String &)> callback);

        /** Get the web view component (for layout). */
        juce::WebBrowserComponent *getWebView() { return webView.get(); }

    private:
        std::unique_ptr<juce::WebBrowserComponent> webView;
        std::function<void(const juce::String &)> jsMessageCallback;

        // Queue for messages to send to JS (thread-safe)
        std::mutex sendQueueMutex;
        std::vector<juce::String> sendQueue;

        // Timer to flush the send queue on the message thread
        class SendTimer;
        std::unique_ptr<SendTimer> sendTimer;
    };

} // namespace rau
