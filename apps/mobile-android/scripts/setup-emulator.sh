#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdks/jdk-17.0.19+10}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

AVD_NAME="${1:-Pixel_7_API_35}"

echo "Installing emulator system image (android-35)..."
sdkmanager "system-images;android-35;google_apis;x86_64" "emulator"

if ! avdmanager list avd | grep -q "Name: $AVD_NAME"; then
  echo "Creating AVD: $AVD_NAME"
  echo "no" | avdmanager create avd \
    --name "$AVD_NAME" \
    --package "system-images;android-35;google_apis;x86_64" \
    --device "pixel_7"
else
  echo "AVD '$AVD_NAME' already exists."
fi

echo
echo "Run the emulator with:"
echo "  emulator -avd $AVD_NAME"
