import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' keeps asset paths relative so the build works on GitHub Pages
// subpaths and other static hosts without extra config (paired with HashRouter).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // ES module workers. The OpenCV.js worker loads opencv.js via fetch+eval
  // (not importScripts), so a standard module worker works in dev and build.
  worker: { format: 'es' },
});
