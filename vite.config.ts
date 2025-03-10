import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.', // Reset root to project root
  build: {
    outDir: 'dist', // Output to dist in project root
    emptyOutDir: true, // Clear output directory
    rollupOptions: {
      input: 'src/index.tsx' // Direct entry point from project root
    }
  }
});