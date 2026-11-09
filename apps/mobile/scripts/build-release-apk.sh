#!/usr/bin/env bash
# Builds the signed release APK. Run after `pnpm prebuild:android`.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

# The NDK and CMake are only needed to compile the New Architecture C++ that
# RN 0.79 / Expo SDK 53 generates, so they are not in the base install.
"$SDKMANAGER" "ndk;27.1.12297006" "cmake;3.22.1"

# Gradle's generated default of 2 GB is not enough to compile the native
# modules; give the daemon room to keep the build off swap.
python3 - <<'PY'
import pathlib, re
p = pathlib.Path("android/gradle.properties")
s = p.read_text()
s = re.sub(r"^org\.gradle\.jvmargs=.*$",
           "org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g", s, flags=re.M)
if "org.gradle.parallel" not in s:
    s += "\norg.gradle.parallel=true\norg.gradle.caching=true\n"
p.write_text(s)
PY

cd android
./gradlew assembleRelease --console=plain
