import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendPort = Number(env.FRONTEND_PORT ?? 5173)

  return {
    plugins: [TanStackRouterVite({ quoteStyle: 'single' }), react()],
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/auth': { target: 'http://localhost:8000', changeOrigin: true },
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
      },
    },
  }
})
