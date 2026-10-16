import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // 只有 VITE_ 開頭的變數會進入瀏覽器程式碼；伺服器金鑰請勿使用 VITE_ 前綴
  envPrefix: "VITE_",
  build: { sourcemap: false },
});
