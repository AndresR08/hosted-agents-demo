import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// This app is a browser client only. Per DESIGN_DECISIONS.md / ARCHITECTURE.md,
// it must never hold Azure credentials or call Azure directly (CORS + secret exposure).
// All Azure calls go through the locally-hosted broker process in ../broker, reached
// here via VITE_BROKER_BASE_URL (see src/config/env.ts).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // The broker only allows its own origin, so a browser on localhost cannot
    // call a *deployed* one directly. Set BROKER_PROXY_TARGET to forward /api
    // server-side instead; no credential is involved, the target authenticates
    // with its own managed identity. Unset, this is inert and the local broker
    // in ../broker is reached the normal way through VITE_BROKER_BASE_URL.
    proxy: process.env.BROKER_PROXY_TARGET
      ? {
          "/api": {
            target: process.env.BROKER_PROXY_TARGET,
            changeOrigin: true,
          },
        }
      : undefined,
  },
});
