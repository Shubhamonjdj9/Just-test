import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
