import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/d3-')) {
            return 'vendor-d3';
          }
          if (
            id.includes('recharts/es6/cartesian') ||
            id.includes('recharts/lib/cartesian')
          ) {
            return 'vendor-recharts-cartesian';
          }
          if (id.includes('node_modules/recharts')) {
            return 'vendor-recharts-core';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
