import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Ensures relative paths for file:// protocol
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    assetsDir: 'src', // Output assets to src folder as requested
    rollupOptions: {
      output: {
        manualChunks: undefined, // Prevent code-splitting to ensure a single JS entry
      }
    }
  },
});
