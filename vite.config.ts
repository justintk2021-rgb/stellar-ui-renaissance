import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Only isolate the genuinely heavy, route-specific leaf libraries.
        // Splitting tightly-coupled deps (react/react-router/radix/supabase) across
        // separate chunks caused a cross-chunk circular init ("Cannot access 'X'
        // before initialization") that crashed the app before React could mount.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three") || id.includes("@react-three")) return "vendor-three";
            if (id.includes("recharts")) return "vendor-charts";
          }
        },
      },
    },
  },
});
