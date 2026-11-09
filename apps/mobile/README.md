# Movie Match Mobile v0.2

Expo / React Native mobile client for the Movie Match API.

## Requirements
- Node.js 20+
- pnpm 10+
- Expo CLI via the local Expo package
- Android Studio/emulator or Expo Go on a physical phone

## Local API URL
A physical phone cannot reach `127.0.0.1` on your development machine. Find the machine LAN IP and set:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api
EXPO_PUBLIC_WS_URL=ws://192.168.x.x:8000
```

The FastAPI server must listen on the LAN interface:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

For an Android emulator you can normally use `http://10.0.2.2:8000/api` and `ws://10.0.2.2:8000`.

## Install
From repository root:

```bash
pnpm install
pnpm --filter @movie-match/mobile exec expo install expo-secure-store react-native-webview
```

## Run

```bash
pnpm dev:mobile
```

Then open the QR code in Expo Go or start an emulator.

## Current flow
Register → automatic login → age gate → create/join room → lobby/realtime → ready → start → trailer/movie → LIKE/DISLIKE/SKIP → match.

## Building an Android APK

The Android project is **generated**, not committed: `apps/mobile/android/` is in
`.gitignore` because it is ~100 files of Gradle boilerplate that `expo prebuild`
recreates from `app.json`. Edit `app.json`, never `android/`.

### One-time setup

Install the Android SDK (no Android Studio needed) and accept the licences:

```bash
mkdir -p ~/Android/Sdk/cmdline-tools && cd /tmp
curl -sSLO https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q commandlinetools-linux-*.zip -d ~/Android/Sdk/cmdline-tools
mv ~/Android/Sdk/cmdline-tools/cmdline-tools ~/Android/Sdk/cmdline-tools/latest

export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

The New Architecture compiles native C++, so the NDK and CMake are also needed.
`pnpm apk:release` installs them for you on the first run.

Create a release signing key (skip this only if you want a debug-signed build):

```bash
pnpm --filter @movie-match/mobile keystore
```

This writes `apps/mobile/.secrets/upload.keystore` plus a `keystore.properties`
holding the password. Both are gitignored. **Back the keystore up.** It is the
app's identity to Google Play — if it is lost, the listing can never be updated
again, no matter how many builds you make.

### Build

```bash
pnpm --filter @movie-match/mobile prebuild:android   # generate android/ + wire signing
pnpm --filter @movie-match/mobile apk:release        # signed APK
```

The APK lands at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

Verify it is signed with the upload key, not the debug key:

```bash
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs \
  apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

For a quick unsigned-ish iteration build use `pnpm --filter @movie-match/mobile apk:debug`
after a `prebuild:android`; it is signed with the standard debug key and installs
on any device.

### Troubleshooting

**`cannot find symbol: class ExpoModulesPackage` at `:app:compileReleaseJavaWithJavac`**

The generated `PackageList.java` imports a class that does not exist. It is
almost certainly the pnpm autolinking issue described in the root `.npmrc`, not
something wrong with your code. Check what autolinking actually resolved:

```bash
cd apps/mobile/android
node --no-warnings --eval "require(require.resolve('expo-modules-autolinking', { paths: [require.resolve('expo/package.json')] }))(process.argv.slice(1))" \
  -- react-native-config --platform android --json | grep packageImportPath
```

The answer must be `import expo.modules.ExpoModulesPackage;`. If it says
`expo.core`, the fix is the `public-hoist-pattern` entry in `.npmrc` followed by
`pnpm install --force`. Do not edit `android/` — `expo prebuild` overwrites it.

**`Could not get unknown property 'projectRoot'` while configuring `:expo-constants`**

A stray `expo-constants` from a much newer SDK is installed. `expo-router`
declares it as an optional peer with a `*` range, which resolves to the newest
published version. It is pinned in `package.json` to the SDK 53 version for
exactly this reason; keep that pin.

### How release signing is wired

`expo prebuild` overwrites `android/` on every run, so edits there do not
survive. `scripts/configure-android-release.js` runs after each prebuild and
injects a `signingConfigs.release` block into `app/build.gradle`, then points the
`release` build type at it. Without that step Gradle signs release builds with
the *debug* key — the APK installs but Google Play rejects it, silently.

Credentials are read from `MM_UPLOAD_*` environment variables first, then
`apps/mobile/.secrets/keystore.properties`. The script is idempotent, so
repeated prebuilds do not accumulate `signingConfig` lines.

```bash
# CI / a machine without the .secrets directory:
export MM_UPLOAD_STORE_FILE=/path/to/upload.keystore
export MM_UPLOAD_STORE_PASSWORD=...
export MM_UPLOAD_KEY_ALIAS=upload
export MM_UPLOAD_KEY_PASSWORD=...
```

If none are set the script prints a warning and leaves Expo's debug signing in
place, so the difference is never silent.

