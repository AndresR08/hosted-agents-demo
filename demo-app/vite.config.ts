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
  },
});
