import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:5050";

// https://vite.dev/config/
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: process.env.VITE_BASE_URL || "/",
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  publicDir: resolve(__dirname, "public"),
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
