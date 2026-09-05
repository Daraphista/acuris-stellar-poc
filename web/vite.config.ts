import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Served from a custom domain (testnet.acurismed.com) at the root, not a repo-name subpath.
// Override with VITE_BASE for local static-preview testing at a different mount point.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Lets the digest calculator import a real fixture manifest directly, so the demo can
      // never silently drift from the file docs/evidence.md and the Rust/TS test suites use —
      // there's exactly one copy of it, not a hand-transcribed duplicate.
      "@fixtures": fileURLToPath(new URL("../fixtures", import.meta.url)),
    },
  },
  server: {
    fs: {
      // Needed only because @fixtures resolves outside web/'s own root — Vite's dev server
      // otherwise refuses to serve files outside the project directory. Irrelevant to
      // `vite build`, which reads the filesystem directly.
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
