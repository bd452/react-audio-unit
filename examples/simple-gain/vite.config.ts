import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/ui",
    emptyOutDir: true,
    rollupOptions: {
      output: {
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
