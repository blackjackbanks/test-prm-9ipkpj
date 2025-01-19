// vite.config.ts
// @vitejs/plugin-react v4.0.0
// vite v4.3.9
// path from node:path

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for React components
      fastRefresh: true,
      // Use the new JSX transform
      jsxRuntime: 'automatic',
      // Configure Babel plugins
      babel: {
        plugins: ['styled-components']
      }
    })
  ],

  // Path aliases for clean imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@assets': path.resolve(__dirname, './src/assets')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    // Proxy configuration for API and WebSocket connections
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        secure: false
      }
    },
    // Hot Module Replacement settings
    hmr: {
      overlay: true
    }
  },

  // Preview server configuration
  preview: {
    port: 3000,
    strictPort: true
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Target modern browsers as per requirements
    target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Chunk splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@reduxjs/toolkit', '@tanstack/react-query'],
          styles: ['styled-components'],
          ui: ['@mui/material', '@mui/icons-material']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },

  // CSS configuration
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@styles/variables";',
        sourceMap: true
      }
    },
    modules: {
      localsConvention: 'camelCase'
    }
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    typecheck: {
      ignoreSourceErrors: false
    }
  },

  // Global defines
  define: {
    __APP_VERSION__: 'JSON.stringify(process.env.npm_package_version)',
    __DEV__: "process.env.NODE_ENV === 'development'"
  }
});