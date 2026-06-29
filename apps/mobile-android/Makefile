SHELL := /bin/bash
GRADLE := ./gradlew
APK_DEBUG := app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := app/build/outputs/apk/release/app-release.apk

.PHONY: build-debug build-release install clean devices logcat sync-env

sync-env:
	@export JAVA_HOME="$$HOME/.local/jdks/jdk-17.0.19+10"; \
	export ANDROID_HOME="$$HOME/Android/Sdk"; \
	export ANDROID_SDK_ROOT="$$ANDROID_HOME"; \
	export PATH="$$JAVA_HOME/bin:$$ANDROID_HOME/cmdline-tools/latest/bin:$$ANDROID_HOME/platform-tools:$$ANDROID_HOME/emulator:$$PATH"

build-debug: sync-env
	@export JAVA_HOME="$$HOME/.local/jdks/jdk-17.0.19+10"; \
	export ANDROID_HOME="$$HOME/Android/Sdk"; \
	export PATH="$$JAVA_HOME/bin:$$ANDROID_HOME/platform-tools:$$PATH"; \
	$(GRADLE) assembleDebug

build-release: sync-env
	@export JAVA_HOME="$$HOME/.local/jdks/jdk-17.0.19+10"; \
	export ANDROID_HOME="$$HOME/Android/Sdk"; \
	export PATH="$$JAVA_HOME/bin:$$ANDROID_HOME/platform-tools:$$PATH"; \
	$(GRADLE) assembleRelease

install: build-debug sync-env
	@export ANDROID_HOME="$$HOME/Android/Sdk"; \
	export PATH="$$ANDROID_HOME/platform-tools:$$PATH"; \
	adb install -r $(APK_DEBUG)

clean:
	$(GRADLE) clean

devices: sync-env
	@export ANDROID_HOME="$$HOME/Android/Sdk"; \
	export PATH="$$ANDROID_HOME/platform-tools:$$PATH"; \
	adb devices -l

logcat: sync-env
	@export ANDROID_HOME="$$HOME/Android/Sdk"; \
	export PATH="$$ANDROID_HOME/platform-tools:$$PATH"; \
	adb logcat
