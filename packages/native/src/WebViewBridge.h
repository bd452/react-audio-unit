#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include <functional>
#include <string>
#include <vector>
#include <mutex>

namespace rau
{

    /**
     * WebViewBridge — manages bidirectional communication between
     * the JUCE C++ plugin and the React UI running in a WebView.
     *
     * JS → C++: via JUCE WebBrowserComponent event listener integration
     * C++ → JS: via evaluateJavascript() dispatched on the message thread
     *
     * The bridge does NOT own the WebBrowserComponent. The PluginEditor
     * creates it and passes a raw pointer here via setWebView().
     */
    class WebViewBridge
    {
    public:
        WebViewBridge();
        ~WebViewBridge();

        /**
         * Get the WebBrowserComponent::Options configured with the
         * JS→C++ event listener bridge. The caller (PluginEditor) uses these
         * options to create the WebBrowserComponent.
         */
        juce::WebBrowserComponent::Options createWebViewOptions();

        /**
         * Set the WebView to use for C++→JS messaging.
         * Called by PluginEditor after creating the WebBrowserComponent.
         * Pass nullptr to disconnect.
         */
        void setWebView(juce::WebBrowserComponent *wv);

        /**
         * Send a JSON message to the JS side.
         * Thread-safe — can be called from any thread. Messages are
         * dispatched to the WebView on the message thread via timer.
         */
        void sendToJS(const juce::String &jsonMessage);

        /**
         * Register a callback for messages received from JS.
         */
        void onMessageFromJS(std::function<void(const juce::String &)> callback);

    private:
        juce::WebBrowserComponent *webView = nullptr; // non-owning
        std::function<void(const juce::String &)> jsMessageCallback;

        // Queue for messages to send to JS (thread-safe)
        std::mutex sendQueueMutex;
        std::vector<juce::String> sendQueue;

        // Timer to flush the send queue on the message thread
        class SendTimer;
        std::unique_ptr<SendTimer> sendTimer;
    };

} // namespace rau
