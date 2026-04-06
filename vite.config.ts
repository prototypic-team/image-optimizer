import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [devtools(), tsconfigPaths(), solidPlugin()],
  assetsInclude: ["**/*.wasm"],
  // Pre-bundling breaks Emscripten’s `new URL("*.wasm", import.meta.url)` — fetch gets HTML (SPA fallback).
  optimizeDeps: {
    exclude: [
      "@jsquash/avif",
      "@jsquash/jpeg",
      "@jsquash/png",
      "@jsquash/webp",
    ],
  },
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: ["index.html", "about.html", "terms.html", "privacy.html"],
    },
  },
});
