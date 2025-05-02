import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base public path when served in production
  base: '/',
  
  // Development server settings
  server: {
    port: 3000,
    open: true, // Automatically open browser
    proxy: {
      // Forward API requests to your Flask backend
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true
      },
      // Forward WebSocket connections to your Flask backend
      '/socket.io': {
        target: 'http://localhost:5050',
        ws: true
      }
    }
  },
  
  // Build options
  build: {
    // Output directory (relative to project root)
    outDir: 'dist',
    
    // Enable source maps for debugging
    sourcemap: true,
    
    // Configure output file formats
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Configure file naming
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Put CSS files in assets/css/ directory
          if (assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          // Put image files in assets/images/ directory
          if (/\.(png|jpe?g|gif|svg|webp)$/.test(assetInfo.name)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          // Default naming for other assets
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    
    // Minify output for production
    minify: 'terser',
    
    // Configure how assets are handled
    assetsInlineLimit: 4096 // Assets smaller than 4kb will be inlined as base64
  }
});