import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Không còn dùng loadEnv/define để nhúng API key nữa — key giờ chỉ tồn tại
// phía server trong api/convert.ts, đọc trực tiếp qua process.env.GEMINI_API_KEY
// khi chạy trên Vercel (hoặc qua `vercel dev` khi chạy local).
export default defineConfig({
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
