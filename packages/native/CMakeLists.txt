cmake_minimum_required(VERSION 3.22)

# These variables must be set by the consumer (the CLI build script)
# before including this file, or passed as -D flags:
#
#   RAU_PLUGIN_NAME          - Display name (e.g. "My Echo Plugin")
#   RAU_PLUGIN_VENDOR        - Vendor name (e.g. "My Company")
#   RAU_PLUGIN_CODE          - 4-char plugin code (e.g. "McEp")
#   RAU_VENDOR_CODE          - 4-char vendor code (e.g. "MyCo")
#   RAU_PLUGIN_VERSION       - Semver string (e.g. "1.0.0")
#   RAU_PLUGIN_IS_SYNTH      - ON/OFF (is this an instrument?)
#   RAU_PLUGIN_NEEDS_MIDI    - ON/OFF
#   RAU_PLUGIN_CHANNELS_IN   - Number of input channels
#   RAU_PLUGIN_CHANNELS_OUT  - Number of output channels
#   RAU_UI_WIDTH             - Editor width in pixels
#   RAU_UI_HEIGHT            - Editor height in pixels
#   RAU_WEB_UI_DIR           - Path to the built web UI (index.html + JS/CSS)
#   RAU_BUILD_AU             - ON/OFF
#   RAU_BUILD_VST3           - ON/OFF
#   RAU_BUILD_AAX            - ON/OFF

if(NOT DEFINED RAU_PLUGIN_NAME)
    set(RAU_PLUGIN_NAME "ReactAudioUnit Plugin" CACHE STRING "")
endif()
if(NOT DEFINED RAU_PLUGIN_VENDOR)
    set(RAU_PLUGIN_VENDOR "ReactAudioUnit" CACHE STRING "")
endif()
if(NOT DEFINED RAU_PLUGIN_CODE)
    set(RAU_PLUGIN_CODE "RaUp" CACHE STRING "")
endif()
if(NOT DEFINED RAU_VENDOR_CODE)
    set(RAU_VENDOR_CODE "RAUn" CACHE STRING "")
endif()
if(NOT DEFINED RAU_PLUGIN_VERSION)
    set(RAU_PLUGIN_VERSION "0.1.0" CACHE STRING "")
endif()
if(NOT DEFINED RAU_PLUGIN_IS_SYNTH)
    set(RAU_PLUGIN_IS_SYNTH OFF CACHE BOOL "")
endif()
if(NOT DEFINED RAU_PLUGIN_NEEDS_MIDI)
    set(RAU_PLUGIN_NEEDS_MIDI OFF CACHE BOOL "")
endif()
if(NOT DEFINED RAU_PLUGIN_CHANNELS_IN)
    set(RAU_PLUGIN_CHANNELS_IN 2 CACHE STRING "")
endif()
if(NOT DEFINED RAU_PLUGIN_CHANNELS_OUT)
    set(RAU_PLUGIN_CHANNELS_OUT 2 CACHE STRING "")
endif()
if(NOT DEFINED RAU_UI_WIDTH)
    set(RAU_UI_WIDTH 600 CACHE STRING "")
endif()
if(NOT DEFINED RAU_UI_HEIGHT)
    set(RAU_UI_HEIGHT 400 CACHE STRING "")
endif()
if(NOT DEFINED RAU_BUILD_AU)
    set(RAU_BUILD_AU ON CACHE BOOL "")
endif()
if(NOT DEFINED RAU_BUILD_VST3)
    set(RAU_BUILD_VST3 ON CACHE BOOL "")
endif()
if(NOT DEFINED RAU_BUILD_AAX)
    set(RAU_BUILD_AAX OFF CACHE BOOL "")
endif()

project(ReactAudioUnitPlugin VERSION ${RAU_PLUGIN_VERSION})

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Sanitize the plugin name into a valid CMake target name (no spaces)
string(REGEX REPLACE "[^a-zA-Z0-9_]" "" RAU_TARGET_NAME "${RAU_PLUGIN_NAME}")

# ---------------------------------------------------------------------------
# Fetch JUCE
# ---------------------------------------------------------------------------
include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        8.0.4
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

# ---------------------------------------------------------------------------
# Determine plugin formats
# ---------------------------------------------------------------------------
set(RAU_FORMATS "")
if(RAU_BUILD_AU AND APPLE)
    list(APPEND RAU_FORMATS AU)
endif()
if(RAU_BUILD_VST3)
    list(APPEND RAU_FORMATS VST3)
endif()
if(RAU_BUILD_AAX)
    list(APPEND RAU_FORMATS AAX)
endif()
# Always build Standalone for development/testing
list(APPEND RAU_FORMATS Standalone)

# ---------------------------------------------------------------------------
# Plugin target
# ---------------------------------------------------------------------------
set(RAU_NATIVE_SRC_DIR "${CMAKE_CURRENT_LIST_DIR}/src")

juce_add_plugin(${RAU_TARGET_NAME}
    COMPANY_NAME                "${RAU_PLUGIN_VENDOR}"
    PLUGIN_MANUFACTURER_CODE    "${RAU_VENDOR_CODE}"
    PLUGIN_CODE                 "${RAU_PLUGIN_CODE}"
    PRODUCT_NAME                "${RAU_PLUGIN_NAME}"
    FORMATS                     ${RAU_FORMATS}
    IS_SYNTH                    ${RAU_PLUGIN_IS_SYNTH}
    NEEDS_MIDI_INPUT            ${RAU_PLUGIN_NEEDS_MIDI}
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD     TRUE
)

# ---------------------------------------------------------------------------
# Source files
# ---------------------------------------------------------------------------
target_sources(${RAU_TARGET_NAME} PRIVATE
    ${RAU_NATIVE_SRC_DIR}/PluginProcessor.cpp
    ${RAU_NATIVE_SRC_DIR}/PluginEditor.cpp
    ${RAU_NATIVE_SRC_DIR}/WebViewBridge.cpp
    ${RAU_NATIVE_SRC_DIR}/AudioGraph.cpp
    ${RAU_NATIVE_SRC_DIR}/ParameterStore.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/GainNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/DelayNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/FilterNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/MixNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/OscillatorNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/CompressorNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/ReverbNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/DistortionNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/PanNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/LFONode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/EnvelopeNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/MeterNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/SpectrumNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/ConvolverNode.cpp
    ${RAU_NATIVE_SRC_DIR}/nodes/NodeFactory.cpp
)

target_include_directories(${RAU_TARGET_NAME} PRIVATE
    ${RAU_NATIVE_SRC_DIR}
)

# ---------------------------------------------------------------------------
# Compile definitions from plugin config
# ---------------------------------------------------------------------------
target_compile_definitions(${RAU_TARGET_NAME} PUBLIC
    JUCE_WEB_BROWSER=1
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    RAU_UI_WIDTH=${RAU_UI_WIDTH}
    RAU_UI_HEIGHT=${RAU_UI_HEIGHT}
    RAU_CHANNELS_IN=${RAU_PLUGIN_CHANNELS_IN}
    RAU_CHANNELS_OUT=${RAU_PLUGIN_CHANNELS_OUT}
)

# ---------------------------------------------------------------------------
# Embed web UI as binary resources (production build)
# ---------------------------------------------------------------------------
if(DEFINED RAU_WEB_UI_DIR AND EXISTS "${RAU_WEB_UI_DIR}/index.html")
    file(GLOB_RECURSE RAU_WEB_UI_FILES "${RAU_WEB_UI_DIR}/*")
    juce_add_binary_data(${RAU_TARGET_NAME}_WebUI
        SOURCES ${RAU_WEB_UI_FILES}
    )
    target_link_libraries(${RAU_TARGET_NAME} PRIVATE ${RAU_TARGET_NAME}_WebUI)
    target_compile_definitions(${RAU_TARGET_NAME} PRIVATE RAU_EMBEDDED_UI=1)
else()
    message(STATUS "No embedded UI — WebView will load from dev server")
    target_compile_definitions(${RAU_TARGET_NAME} PRIVATE RAU_EMBEDDED_UI=0)
endif()

# ---------------------------------------------------------------------------
# Link JUCE modules
# ---------------------------------------------------------------------------
target_link_libraries(${RAU_TARGET_NAME}
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_gui_extra       # WebBrowserComponent lives here
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_warning_flags
)
