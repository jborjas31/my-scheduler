import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
    host: 'localhost',
    strictPort: true,
    hmr: {
      port: 3001,
      host: 'localhost'
    }
  },
  base: './',
  // Ensure proper file serving
  publicDir: false, // Since we're using src as root
  // Fix CSS serving issues
  css: {
    devSourcemap: true
  }
});