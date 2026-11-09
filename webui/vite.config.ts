import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { fizgigProxyPlugin } from "./server/fizgig-proxy";

export default defineConfig({
  plugins: [vue(), tailwindcss(), fizgigProxyPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 8084,
  },
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
