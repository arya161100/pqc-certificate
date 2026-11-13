import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The contract artifacts live in ../contracts and are imported directly
  // from app/src/lib/qore.ts (single source of truth, no ABI duplication).
  server: {
    fs: {
      allow: [".."],
    },
  },
});
