import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "../auth/assets",
    emptyOutDir: false,
    target: "es2020",
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        app: "src/app.css",
        vendor: "src/vendor.ts",
        webauthn: "src/webauthn.ts",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
