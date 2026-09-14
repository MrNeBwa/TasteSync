import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  const apiPort = env.VITE_API_PORT || "8000";
  const apiTarget =
    env.VITE_DEV_API_TARGET || `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],

    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,

      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },

        "/ws": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },

    preview: {
      host: "0.0.0.0",
      port: 4173,
      strictPort: true,

      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },

        "/ws": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});