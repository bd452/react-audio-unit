import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/ui",
    emptyOutDir: true,
    // Single-page app — everything in one HTML file for plugin embedding
    rollupOptions: {
      output: {
        // Inline small assets to reduce file count
        assetFileNames: "assets/[name].[ext]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/[name].js",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
