import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// "npm run build" writes the finished site into ../backend/public, which the Express server serves.
// "npm run dev" runs the React dev server on :5173 and forwards /api calls to the backend on :5000.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
