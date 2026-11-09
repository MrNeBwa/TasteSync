#!/usr/bin/env bash
# Builds the signed release APK. Run after `pnpm prebuild:android`.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# Gradle 8.x supports up to JDK 21; if the system default Java is newer (e.g. 25/27),
# automatically pick an installed JDK 21 or 17 when JAVA_HOME is not explicitly set.
if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in \
    /usr/lib/jvm/java-21-openjdk \
    /usr/lib/jvm/java-17-openjdk \
    "$HOME/.local/share/PrismLauncher/java/java-runtime-delta" \
    "$HOME/.local/share/PrismLauncher/java/java-runtime-gamma"; do
    if [ -x "$candidate/bin/javac" ]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

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
