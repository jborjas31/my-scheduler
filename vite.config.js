import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Build optimizations
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/firestore']
        },
        // Asset naming for cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Bundle size reporting
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500
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
  // CSS optimizations
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      // Enable CSS imports optimization
      css: {
        charset: false
      }
    }
  },
  // Dependency optimization
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/firestore'
    ],
    exclude: []
  },
  // Plugin optimizations
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [], // Remove console.log in production only
    legalComments: 'none'
  }
});