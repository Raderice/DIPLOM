import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["boardgamesarena.ru"],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true
      },
      "/realtime": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: ["boardgamesarena.ru", "www.boardgamesarena.ru", "91.107.122.49"]
  }
});
