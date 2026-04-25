/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // When running plain `vite dev`, proxy /api/* to vercel dev (port 3000).
    // For full local dev with API routes, run `vercel dev` instead.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
