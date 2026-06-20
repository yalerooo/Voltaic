import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite is configured for Tauri: a fixed dev port the Tauri window points at,
// and a build target matching the bundled WebView engines.
export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port and fails if it is taken.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: {
      // Don't watch the Rust side — it has its own rebuild loop.
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Edge WebView2 (Win), WKWebView (macOS), WebKitGTK (Linux).
    target: ["es2021", "chrome105", "safari15"],
    minify: "esbuild",
    sourcemap: false,
    outDir: "dist",
  },
});
