import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.', // Project root
  publicDir: 'public', // Keep public assets
  base: '/', // Assets at root level (dist/assets/)
  build: {
    outDir: 'dist', // Output to dist
    emptyOutDir: true, // Clear output directory
    rollupOptions: {
      input: resolve(__dirname, 'public/index.html') // HTML entry point
    }
  }
});