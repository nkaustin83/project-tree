// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@data': path.resolve(__dirname, './src/data'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Expose to network for mobile testing
    proxy: {
      // General API proxy (for most requests)
      '/api': {
        target: 'https://sandbox.procore.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Dedicated OAuth proxy (for authentication)
      '/oauth': {
        target: 'https://login-sandbox.procore.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('OAuth proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending OAuth Request:', req.method, req.url);
            // Set proper headers for OAuth requests
            proxyReq.setHeader('Origin', 'https://login-sandbox.procore.com');
            proxyReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received OAuth Response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
});