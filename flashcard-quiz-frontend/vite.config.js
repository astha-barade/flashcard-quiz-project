import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_API_BASE_URL || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Forward /api/* to the Spring Boot backend during development.
      proxy: {
        '/api': { target: backend, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:18080', VITE_USE_DEV_PROXY: 'false' },
    },
  }
})
