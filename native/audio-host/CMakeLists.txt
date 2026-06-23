cmake_minimum_required(VERSION 3.22)

project(audio-host VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG        8.0.6
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_console_app(audio-host
  PRODUCT_NAME "audio-host"
  NEEDS_CONSOLE_APPLICATION TRUE)

target_sources(audio-host PRIVATE src/main.cpp)

target_compile_definitions(audio-host PRIVATE
  JUCE_PLUGINHOST_VST3=1
  JUCE_PLUGINHOST_AU=1
  JUCE_WEB_BROWSER=0
  JUCE_USE_CURL=0)

target_link_libraries(audio-host PRIVATE
  juce::juce_audio_utils
  juce::juce_audio_processors
  juce::juce_recommended_config_flags
  juce::juce_recommended_warning_flags)
