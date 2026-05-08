import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "node:path";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), tailwind(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, "offscreen.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
