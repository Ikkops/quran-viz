import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. Base is relative so it can be hosted from any subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
