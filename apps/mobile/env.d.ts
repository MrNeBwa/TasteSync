/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_WS_URL?: string;
  }
}