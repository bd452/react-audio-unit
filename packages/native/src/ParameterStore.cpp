#include "ParameterStore.h"

namespace rau
{

    ParameterStore::ParameterStore(juce::AudioProcessor & /*proc*/) {}

    ParameterStore::~ParameterStore()
    {
        if (apvts)
        {
            for (auto &[jsId, slotId] : idToSlot)
            {
                apvts->removeParameterListener(slotId, this);
            }
        }
    }

    juce::AudioProcessorValueTreeState::ParameterLayout ParameterStore::createLayout(int maxParams)
    {
        juce::AudioProcessorValueTreeState::ParameterLayout layout;

        // Pre-allocate generic parameter slots (param_000, param_001, ...)
        // These start with a 0–1 range and get their actual range mapped
        // dynamically when JS registers parameters.
        for (int i = 0; i < maxParams; ++i)
        {
            auto slotId = juce::String("param_") + juce::String(i).paddedLeft('0', 3);
            layout.add(std::make_unique<juce::AudioParameterFloat>(
                juce::ParameterID(slotId, 1),
                slotId, // name (updated dynamically)
                juce::NormalisableRange<float>(0.0f, 1.0f),
                0.0f));
        }

        return layout;
    }

    void ParameterStore::bindAPVTS(juce::AudioProcessorValueTreeState &vts)
    {
        apvts = &vts;
    }

    void ParameterStore::registerParameter(const std::string &id, float min, float max,
                                           float defaultValue, const std::string &label)
    {
        if (!apvts || idToSlot.count(id))
            return;

        // Assign the next available slot
        auto slotId = "param_" + juce::String(nextSlot).paddedLeft('0', 3).toStdString();
        idToSlot[id] = slotId;
        slotToId[slotId] = id;

        // Store the range mapping for this parameter
        rangeMap[slotId] = {min, max};

        nextSlot++;

        // Set the normalized default value
        if (auto *param = apvts->getParameter(slotId))
        {
            float normalizedDefault = (max > min) ? (defaultValue - min) / (max - min) : 0.0f;
            param->setValueNotifyingHost(juce::jlimit(0.0f, 1.0f, normalizedDefault));
        }

        // Listen for DAW automation changes on this slot
        apvts->addParameterListener(slotId, this);

        (void)label; // Label used in future UI display
    }

    void ParameterStore::setParameterValue(const std::string &id, float value)
    {
        auto it = idToSlot.find(id);
        if (it == idToSlot.end() || !apvts)
            return;

        if (auto *param = apvts->getParameter(it->second))
        {
            // Convert actual value to normalized 0–1 using stored range
            auto rangeIt = rangeMap.find(it->second);
            if (rangeIt != rangeMap.end())
            {
                float min = rangeIt->second.first;
                float max = rangeIt->second.second;
                float normalized = (max > min) ? (value - min) / (max - min) : 0.0f;
                param->setValueNotifyingHost(juce::jlimit(0.0f, 1.0f, normalized));
            }
            else
            {
                param->setValueNotifyingHost(juce::jlimit(0.0f, 1.0f, value));
            }
        }
    }

    float ParameterStore::getParameterValue(const std::string &id) const
    {
        auto it = idToSlot.find(id);
        if (it == idToSlot.end() || !apvts)
            return 0.0f;

        if (auto *param = apvts->getParameter(it->second))
        {
            // Convert normalized 0–1 back to actual value using stored range
            float normalized = param->getValue();
            auto rangeIt = rangeMap.find(it->second);
            if (rangeIt != rangeMap.end())
            {
                float min = rangeIt->second.first;
                float max = rangeIt->second.second;
                return min + normalized * (max - min);
            }
            return normalized;
        }
        return 0.0f;
    }

    void ParameterStore::onParameterChanged(std::function<void(const std::string &, float)> callback)
    {
        changeCallback = std::move(callback);
    }

    void ParameterStore::parameterChanged(const juce::String &parameterID, float newValue)
    {
        if (changeCallback)
        {
            auto it = slotToId.find(parameterID.toStdString());
            if (it != slotToId.end())
            {
                // Convert normalized value back to actual range
                auto rangeIt = rangeMap.find(parameterID.toStdString());
                float actualValue = newValue;
                if (rangeIt != rangeMap.end())
                {
                    float min = rangeIt->second.first;
                    float max = rangeIt->second.second;
                    actualValue = min + newValue * (max - min);
                }
                changeCallback(it->second, actualValue);
            }
        }
    }

    std::string ParameterStore::getStateAsJson() const
    {
        // Simple JSON serialization of all registered parameters
        std::string json = "{";
        bool first = true;
        for (auto &[jsId, slotId] : idToSlot)
        {
            if (!first)
                json += ",";
            first = false;
            json += "\"" + jsId + "\":" + std::to_string(getParameterValue(jsId));
        }
        json += "}";
        return json;
    }

    void ParameterStore::restoreStateFromJson(const std::string &json)
    {
        // Parse simple JSON object { "key": value, ... }
        // Use JUCE's JSON parser for robustness
        auto parsed = juce::JSON::parse(juce::String(json));
        if (parsed.isVoid())
            return;

        if (auto *obj = parsed.getDynamicObject())
        {
            for (auto &prop : obj->getProperties())
            {
                auto id = prop.name.toString().toStdString();
                float value = static_cast<float>(prop.value);
                setParameterValue(id, value);
            }
        }
    }

} // namespace rau
