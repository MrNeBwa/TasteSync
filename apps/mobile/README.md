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
